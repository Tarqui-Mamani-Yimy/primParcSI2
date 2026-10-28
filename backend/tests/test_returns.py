"""CU31 return and exchange contract tests."""

import asyncio
import json
import sqlite3
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine, select, text
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_tenant_db
from app.main import app
from app.models import (
    Bitacora,
    Ciudad,
    Cliente,
    Colecciones,
    Devolucion,
    DetalleVenta,
    Empresa,
    Inventario,
    MetodoPago,
    Movimiento,
    MovimientoCaja,
    Plan,
    Producto,
    Proveedor,
    Rol,
    Sucursal,
    Suscripcion,
    Temporada,
    Usuario,
    Venta,
)
from app.security import create_access_token, get_current_payload


@compiles(ARRAY, "sqlite")
def _compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@compiles(INET, "sqlite")
def _compile_inet_for_sqlite(_type, _compiler, **_kwargs):
    return "VARCHAR(64)"


@compiles(BigInteger, "sqlite")
def _compile_bigint_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


class AsyncSessionAdapter:
    def __init__(self, session):
        self.session = session

    async def execute(self, *args, **kwargs):
        return self.session.execute(*args, **kwargs)

    async def get(self, *args, **kwargs):
        return self.session.get(*args, **kwargs)

    def add(self, instance):
        self.session.add(instance)

    async def flush(self):
        self.session.flush()

    async def commit(self):
        self.session.commit()

    async def rollback(self):
        self.session.rollback()

    async def refresh(self, instance):
        self.session.refresh(instance)


@pytest.fixture
def return_env(monkeypatch):
    import app.database as database

    monkeypatch.setattr(database, "_set_local_tenant_context", lambda *_args: None)
    sqlite3.register_adapter(list, json.dumps)
    sqlite3.register_adapter(dict, json.dumps)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    _seed_returns_data(engine)

    async def override_tenant_db(payload=Depends(get_current_payload)):
        with Session(engine) as session:
            session.info.update(tenant_scoped=True, tenant_id=int(payload["empresa"]))
            yield AsyncSessionAdapter(session)

    app.dependency_overrides[get_tenant_db] = override_tenant_db
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, engine=engine)
    finally:
        app.dependency_overrides.pop(get_tenant_db, None)
        engine.dispose()


def _seed_returns_data(engine):
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        session.add(Rol(codigoRol=1, nombreRol="Administrador"))
        for tenant_id in (1, 2):
            user_id = tenant_id * 10
            supplier_id = tenant_id * 10
            season_id = tenant_id * 10
            collection_id = tenant_id * 10
            city_id = tenant_id * 10
            branch_id = tenant_id * 10
            client_id = tenant_id * 100
            payment_id = tenant_id * 100
            sale_id = tenant_id * 100
            session.add(Empresa(
                idEmpresa=tenant_id, nombre=f"Empresa {tenant_id}",
                slug=f"empresa-{tenant_id}", estado="Activa",
            ))
            session.add(Plan(
                idPlan=tenant_id, codigo=f"plan-{tenant_id}", nombre="Prueba",
                precioMensual=Decimal("0.00"), features=["pos", "inventario"], limites={},
            ))
            session.add(Suscripcion(
                idSuscripcion=tenant_id, idEmpresa=tenant_id, idPlan=tenant_id,
                estado="activa", fechaInicio=date(2026, 1, 1),
            ))
            session.add(Ciudad(idCiudad=city_id, nombCiudad=f"Ciudad {tenant_id}"))
            session.add(Usuario(
                idUser=user_id, nombre=f"User {tenant_id}", correo=f"u{tenant_id}@test.local",
                contraseña="unused", codigoRol=1, idEmpresa=tenant_id,
            ))
            session.add(Cliente(
                idCliente=client_id, nombre=f"Cliente {tenant_id}", idUser=user_id,
                idEmpresa=tenant_id,
            ))
            session.add(Proveedor(
                idProveedor=supplier_id, idEmpresa=tenant_id, nombre=f"Proveedor {tenant_id}",
            ))
            session.add(Temporada(
                idTemporada=season_id, idEmpresa=tenant_id, nombreTemporada="Actual",
                fecha_ini=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            ))
            session.add(Colecciones(
                idColeccion=collection_id, idEmpresa=tenant_id, nombre_coleccion="Base",
                idTemporada=season_id,
            ))
            session.add(Sucursal(
                codigoSucursal=branch_id, idEmpresa=tenant_id, nombre=f"Sucursal {tenant_id}",
                direccion="Centro", idCiudad=city_id,
            ))
            session.add(MetodoPago(
                idMetPago=payment_id, idEmpresa=tenant_id,
                tipo="Efectivo" if tenant_id == 1 else "Tarjeta (Stripe)",
                estado="Activo", monto=Decimal("150.00"),
                stripePaymentIntentId="pi_original" if tenant_id == 2 else None,
                moneda="usd" if tenant_id == 2 else None,
                estadoStripe="succeeded" if tenant_id == 2 else None,
                origen="tarjeta_stripe" if tenant_id == 2 else "caja",
                idUserPago=user_id,
            ))
            original_product_id = tenant_id * 100 + 1
            replacement_product_id = tenant_id * 100 + 2
            expensive_product_id = tenant_id * 100 + 3
            for product_id, product_name, price in (
                (original_product_id, "Original", Decimal("50.00")),
                (replacement_product_id, "Replacement cheaper", Decimal("40.00")),
                (expensive_product_id, "Replacement dearer", Decimal("70.00")),
            ):
                session.add(Producto(
                    idProducto=product_id, idEmpresa=tenant_id, nombre=product_name,
                    costo=Decimal("20.00"), venta=price,
                    idProveedor=supplier_id, idColeccion=collection_id,
                ))
            original_inventory_id = tenant_id * 100 + 1
            cheaper_inventory_id = tenant_id * 100 + 2
            dearer_inventory_id = tenant_id * 100 + 3
            session.add_all([
                Inventario(
                    idInv=original_inventory_id, idEmpresa=tenant_id, cantidad_actual=2,
                    cantidad_reservada=0, codigoSucursal=branch_id,
                    idProducto=original_product_id,
                ),
                Inventario(
                    idInv=cheaper_inventory_id, idEmpresa=tenant_id, cantidad_actual=5,
                    cantidad_reservada=0, codigoSucursal=branch_id,
                    idProducto=replacement_product_id,
                ),
                Inventario(
                    idInv=dearer_inventory_id, idEmpresa=tenant_id, cantidad_actual=5,
                    cantidad_reservada=0, codigoSucursal=branch_id,
                    idProducto=expensive_product_id,
                ),
            ])
            session.add(Venta(
                idVenta=sale_id, idEmpresa=tenant_id,
                fecha=now - timedelta(days=5), total=Decimal("150.00"),
                idCliente=client_id, idMetPago=payment_id,
            ))
            session.add(DetalleVenta(
                codigoVenta=tenant_id * 1000 + 1, idEmpresa=tenant_id,
                cantidad=3, precio_unitario=Decimal("50.00"),
                idProducto=original_product_id, idVenta=sale_id,
            ))
            session.add(Movimiento(
                idMov=tenant_id * 1000 + 1, idEmpresa=tenant_id, tipo="venta",
                cantidad=-3, motivo=f"Venta {sale_id}", idInv=original_inventory_id,
            ))
        session.add(Bitacora(
            idBitacora=1, idEmpresa=1, accion="seed", hora=now.time(),
            fecha=now.date(), ip="127.0.0.1", idUser=10,
        ))
        session.commit()


def _headers(tenant_id=1, permissions=None):
    token = create_access_token(tenant_id * 10, {
        "empresa": tenant_id,
        "rol": "Administrador",
        "permisos": permissions if permissions is not None else ["devolucion.ver", "devolucion.gestionar"],
    })
    return {"Authorization": f"Bearer {token}"}


def _return_payload(tenant_id=1, quantity=1):
    return {
        "sale_id": tenant_id * 100,
        "items": [{"sale_item_id": tenant_id * 1000 + 1, "quantity": quantity}],
    }


def _exchange_payload(tenant_id=1, replacement_product=None):
    return {
        "sale_id": tenant_id * 100,
        "sale_item_id": tenant_id * 1000 + 1,
        "quantity": 1,
        "replacement_product_id": replacement_product or tenant_id * 100 + 2,
        "replacement_quantity": 1,
    }


def test_return_window_rejects_sales_older_than_30_days(return_env):
    with Session(return_env.engine) as session:
        sale = session.get(Venta, 100)
        sale.fecha = datetime.now(timezone.utc) - timedelta(days=31)
        session.commit()

    response = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_window_expired"


def test_return_quantity_is_limited_by_sold_minus_already_returned(return_env):
    first = return_env.client.post("/api/returns", json=_return_payload(quantity=2), headers=_headers())
    assert first.status_code == 201, first.text
    second = return_env.client.post("/api/returns", json=_return_payload(quantity=2), headers=_headers())
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "return_quantity_exceeded"


def test_duplicate_return_lines_cannot_exceed_the_sale_quantity(return_env):
    response = return_env.client.post(
        "/api/returns",
        json={"sale_id": 100, "items": [
            {"sale_item_id": 1001, "quantity": 2},
            {"sale_item_id": 1001, "quantity": 2},
        ]},
        headers=_headers(),
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_quantity_exceeded"


def test_exchange_quantity_counts_toward_the_sale_return_limit(return_env):
    exchange_payload = _exchange_payload(replacement_product=102)
    exchange_payload["quantity"] = 2
    exchange = return_env.client.post(
        "/api/returns/exchanges", json=exchange_payload, headers=_headers()
    )
    assert exchange.status_code == 201, exchange.text
    response = return_env.client.post(
        "/api/returns", json=_return_payload(quantity=2), headers=_headers()
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_quantity_exceeded"


def test_exchange_rejects_sales_outside_the_30_day_window(return_env):
    with Session(return_env.engine) as session:
        sale = session.get(Venta, 100)
        sale.fecha = datetime.now(timezone.utc) - timedelta(days=31)
        session.commit()
    response = return_env.client.post(
        "/api/returns/exchanges", json=_exchange_payload(), headers=_headers()
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "return_window_expired"


def test_return_is_allowed_on_sale_day_30(return_env):
    with Session(return_env.engine) as session:
        sale = session.get(Venta, 100)
        sale.fecha = datetime.now(timezone.utc) - timedelta(days=29, hours=23)
        session.commit()
    response = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert response.status_code == 201, response.text


def test_return_restores_stock_records_movement_and_bitacora(return_env):
    response = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "completed"
    with Session(return_env.engine) as session:
        inventory = session.get(Inventario, 101)
        assert inventory.cantidad_actual == 3
        assert session.scalar(select(Movimiento).where(Movimiento.tipo == "devolucion")) is not None
        assert session.scalar(select(Bitacora).where(Bitacora.accion == "devolucion.completada")) is not None


def test_finalizing_a_completed_return_again_does_not_duplicate_stock_or_movement(return_env):
    from fastapi import Request
    from app.routers.returns import _finalize

    created = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert created.status_code == 201, created.text
    record_id = created.json()["id"]
    request = Request({"type": "http", "client": ("127.0.0.1", 8000), "headers": []})
    auth = {"sub": "1001", "empresa": 1}

    with Session(return_env.engine) as session:
        session.info.update(tenant_scoped=True, tenant_id=1)
        record = session.get(Devolucion, record_id)
        asyncio.run(_finalize(AsyncSessionAdapter(session), record, auth, request, 1))

    with Session(return_env.engine) as session:
        assert session.get(Inventario, 101).cantidad_actual == 3
        assert session.query(Movimiento).filter(Movimiento.tipo == "devolucion").count() == 1


def test_stripe_finalization_reloads_the_return_under_a_row_lock(return_env, monkeypatch):
    import app.routers.returns as returns
    from fastapi import Request
    from types import SimpleNamespace

    created = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert created.status_code == 201, created.text
    with Session(return_env.engine) as session:
        completed = session.get(Devolucion, created.json()["id"])
        assert completed.estado == "completed"

    checked = []
    refund_calls = []

    async def load_completed(session, return_id, tenant_id, *, lock=False):
        checked.append(lock)
        return completed

    async def unexpected_refund(**kwargs):
        refund_calls.append(kwargs)
        raise AssertionError("Completed return must not create another Stripe refund")

    monkeypatch.setattr(returns, "_get_return", load_completed)
    monkeypatch.setattr(returns, "crear_refund", unexpected_refund)
    with Session(return_env.engine) as session:
        session.info.update(tenant_scoped=True, tenant_id=1)
        asyncio.run(returns._refund_and_finalize(
            AsyncSessionAdapter(session),
            SimpleNamespace(idDevolucion=completed.idDevolucion, estado="payment_pending"),
            {"sub": "1001", "empresa": 1},
            Request({"type": "http", "client": ("127.0.0.1", 8000), "headers": []}),
            1,
        ))
    assert checked == [True]
    assert refund_calls == []


def test_locked_return_reload_refreshes_state_already_cached_in_session(return_env, monkeypatch):
    import app.routers.returns as returns

    async def pending_refund(**kwargs):
        return {"id": "re_state_refresh", "amount": 1000, "status": "pending"}

    monkeypatch.setattr(returns, "crear_refund", pending_refund)
    created = return_env.client.post(
        "/api/returns", json=_return_payload(tenant_id=2), headers=_headers(tenant_id=2)
    )
    assert created.status_code == 202, created.text
    return_id = created.json()["id"]
    with Session(return_env.engine) as first:
        first.info.update(tenant_scoped=True, tenant_id=2)
        cached = first.get(Devolucion, return_id)
        assert cached.estado == "payment_pending"
        with Session(return_env.engine) as second:
            second.info.update(tenant_scoped=True, tenant_id=2)
            completed = second.get(Devolucion, return_id)
            completed.estado = "completed"
            second.commit()
        refreshed = asyncio.run(returns._get_return(AsyncSessionAdapter(first), return_id, 2, lock=True))
        assert refreshed.estado == "completed"


def test_cash_refund_registers_cash_egress(return_env):
    response = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert response.status_code == 201, response.text
    assert response.json()["refund_amount"] == "50.00"
    with Session(return_env.engine) as session:
        egress = session.execute(text("SELECT amount, kind FROM movimiento_caja WHERE return_id = :id"), {"id": response.json()["id"]}).one()
        assert Decimal(str(egress.amount)) == Decimal("50.00")
        assert egress.kind == "egreso"


def test_qr_payment_returns_are_rejected_instead_of_refunded_as_cash(return_env):
    with Session(return_env.engine) as session:
        method = session.get(MetodoPago, 100)
        method.tipo = "QR"
        method.origen = "qr"
        session.commit()

    returned = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    exchanged = return_env.client.post(
        "/api/returns/exchanges", json=_exchange_payload(replacement_product=102), headers=_headers()
    )

    assert returned.status_code == 409
    assert exchanged.status_code == 409
    assert returned.json()["detail"]["code"] == "unsupported_sale_payment_method"
    assert exchanged.json()["detail"]["code"] == "unsupported_sale_payment_method"
    with Session(return_env.engine) as session:
        assert session.query(MovimientoCaja).count() == 0
        assert session.get(Inventario, 101).cantidad_actual == 2
        assert session.get(Inventario, 102).cantidad_actual == 5


def test_exchange_refunds_cheaper_replacement_difference_with_stripe(return_env, monkeypatch):
    import app.routers.returns as returns

    stripe_calls = []

    async def fake_refund(**kwargs):
        stripe_calls.append(kwargs)
        return {"id": "re_test_refund", "amount": 1000, "status": "succeeded"}

    monkeypatch.setattr(returns, "crear_refund", fake_refund)
    response = return_env.client.post(
        "/api/returns/exchanges",
        json=_exchange_payload(tenant_id=2),
        headers=_headers(tenant_id=2),
    )
    assert response.status_code == 201, response.text
    assert response.json()["refund_amount"] == "10.00"
    assert response.json()["status"] == "completed"
    assert len(stripe_calls) == 1
    assert stripe_calls[0]["payment_intent_id"] == "pi_original"
    assert stripe_calls[0]["amount"] == Decimal("10.00")
    assert response.json()["stripe_refund_id"] == "re_test_refund"
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 201).cantidad_actual == 3
        assert session.get(Inventario, 202).cantidad_actual == 4
        assert session.scalar(select(Bitacora).where(Bitacora.accion == "cambio.completado")) is not None


def test_failed_stripe_refund_can_be_retried_without_reusing_failed_idempotency_key(return_env, monkeypatch):
    import app.routers.returns as returns

    stripe_calls = []

    async def fake_refund(**kwargs):
        stripe_calls.append(kwargs)
        result = "failed" if len(stripe_calls) == 1 else "succeeded"
        return {"id": f"re_attempt_{len(stripe_calls)}", "amount": 1000, "status": result}

    monkeypatch.setattr(returns, "crear_refund", fake_refund)
    created = return_env.client.post(
        "/api/returns/exchanges",
        json=_exchange_payload(tenant_id=2),
        headers=_headers(tenant_id=2),
    )
    assert created.status_code == 202, created.text
    assert created.json()["status"] == "payment_failed"
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 201).cantidad_actual == 2
        assert session.get(Inventario, 202).cantidad_reservada == 1

    retried = return_env.client.post(
        f"/api/returns/{created.json()['id']}/process", headers=_headers(tenant_id=2)
    )
    assert retried.status_code == 200, retried.text
    assert retried.json()["status"] == "completed"
    assert stripe_calls[0]["idempotency_key"] != stripe_calls[1]["idempotency_key"]
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 201).cantidad_actual == 3
        assert session.get(Inventario, 202).cantidad_actual == 4
        assert session.get(Inventario, 202).cantidad_reservada == 0


def test_pending_stripe_refund_is_reconciled_by_retrieving_its_status(return_env, monkeypatch):
    import app.routers.returns as returns

    created_refunds = []
    retrieved_refunds = []

    async def fake_create_refund(**kwargs):
        created_refunds.append(kwargs)
        return {"id": "re_pending", "amount": 1000, "status": "pending"}

    async def fake_retrieve_refund(refund_id):
        retrieved_refunds.append(refund_id)
        return {"id": refund_id, "amount": 1000, "status": "succeeded"}

    monkeypatch.setattr(returns, "crear_refund", fake_create_refund)
    monkeypatch.setattr(returns, "obtener_refund", fake_retrieve_refund)
    created = return_env.client.post(
        "/api/returns/exchanges", json=_exchange_payload(tenant_id=2), headers=_headers(tenant_id=2)
    )
    assert created.status_code == 202, created.text
    assert created.json()["status"] == "payment_pending"
    completed = return_env.client.post(
        f"/api/returns/{created.json()['id']}/process", headers=_headers(tenant_id=2)
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert len(created_refunds) == 1
    assert retrieved_refunds == ["re_pending"]


def test_cash_exchange_records_additional_collection_and_updates_inventory(return_env):
    response = return_env.client.post(
        "/api/returns/exchanges",
        json=_exchange_payload(replacement_product=103),
        headers=_headers(),
    )
    assert response.status_code == 201, response.text
    assert response.json()["amount_due"] == "20.00"
    assert response.json()["status"] == "completed"
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 101).cantidad_actual == 3
        assert session.get(Inventario, 103).cantidad_actual == 4
        entry = session.execute(
            text("SELECT amount, kind FROM movimiento_caja WHERE return_id = :id"),
            {"id": response.json()["id"]},
        ).one()
        assert Decimal(str(entry.amount)) == Decimal("20.00")
        assert entry.kind == "ingreso"


def test_more_expensive_stripe_exchange_waits_for_confirmed_payment(return_env, monkeypatch):
    import app.routers.returns as returns

    created = []
    verified = []

    async def fake_create_intent(**kwargs):
        created.append(kwargs)
        return {"id": "pi_exchange", "client_secret": "secret_test", "status": "requires_payment_method", "amount": 2000}

    async def fake_get_intent(payment_intent_id):
        verified.append(payment_intent_id)
        return {"id": payment_intent_id, "status": "succeeded", "amount_received": 2000, "currency": "usd", "metadata": {}}

    monkeypatch.setattr(returns, "crear_payment_intent", fake_create_intent)
    monkeypatch.setattr(returns, "obtener_payment_intent", fake_get_intent)
    first = return_env.client.post(
        "/api/returns/exchanges",
        json=_exchange_payload(tenant_id=2, replacement_product=203),
        headers=_headers(tenant_id=2),
    )
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "payment_pending"
    assert first.json()["payment_intent_id"] == "pi_exchange"
    assert first.json()["client_secret"] == "secret_test"
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 201).cantidad_actual == 2
        assert session.get(Inventario, 203).cantidad_actual == 5

    completed = return_env.client.post(
        f"/api/returns/{first.json()['id']}/confirm-payment",
        headers=_headers(tenant_id=2),
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert verified == ["pi_exchange"]
    with Session(return_env.engine) as session:
        assert session.get(Inventario, 201).cantidad_actual == 3
        assert session.get(Inventario, 203).cantidad_actual == 4


def test_foreign_tenant_sale_is_not_visible_or_mutable(return_env):
    own_sale = return_env.client.get(
        "/api/returns/sales/100/returnable-items", headers=_headers(tenant_id=1)
    )
    assert own_sale.status_code == 200, own_sale.text
    foreign_sale_id = 200
    list_response = return_env.client.get(
        f"/api/returns/sales/{foreign_sale_id}/returnable-items", headers=_headers(tenant_id=1)
    )
    assert list_response.status_code == 404
    create_response = return_env.client.post(
        "/api/returns", json=_return_payload(tenant_id=2), headers=_headers(tenant_id=1)
    )
    assert create_response.status_code == 404


def test_returns_require_the_new_manage_permission(return_env):
    response = return_env.client.post(
        "/api/returns", json=_return_payload(), headers=_headers(permissions=["venta.ver"])
    )
    assert response.status_code == 403


def test_return_list_detail_and_returnable_items_are_available_to_permitted_tenant(return_env):
    available = return_env.client.get(
        "/api/returns/sales/100/returnable-items", headers=_headers()
    )
    assert available.status_code == 200, available.text
    assert available.json()[0]["returnable_quantity"] == 3
    created = return_env.client.post("/api/returns", json=_return_payload(), headers=_headers())
    assert created.status_code == 201, created.text
    listed = return_env.client.get("/api/returns", headers=_headers())
    viewed = return_env.client.get(f"/api/returns/{created.json()['id']}", headers=_headers())
    assert listed.status_code == viewed.status_code == 200
    assert len(listed.json()) == 1
    assert viewed.json()["id"] == created.json()["id"]


def test_existing_inventory_adjust_endpoint_keeps_its_response_and_movement_semantics(return_env):
    response = return_env.client.patch(
        "/api/inventory/stock/101/adjust",
        json={"cantidad": 2, "signo": "add", "tipo": "ajuste_manual", "motivo": "conteo"},
        headers=_headers(permissions=["inventario.ajustar"]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["cantidad_actual"] == 4
    with Session(return_env.engine) as session:
        movement = session.scalar(select(Movimiento).where(Movimiento.tipo == "ajuste_manual"))
        assert movement.cantidad == 2
        assert movement.motivo == "conteo"


def test_migration_adds_returns_tables_and_assigns_permissions_to_requested_roles():
    migration = (
        __import__("pathlib").Path(__file__).parents[1]
        / "database/migrations/023_devoluciones_cu31.sql"
    )
    sql = migration.read_text(encoding="utf-8")
    for table in ("devolucion", "devolucion_detalle", "movimiento_caja"):
        assert table in sql
    for role in ("Administrador", "Encargado de Sucursal", "Cajero"):
        assert role in sql
    assert "ON CONFLICT" in sql.upper()


def test_stripe_refund_service_calls_the_provider_with_amount_and_idempotency_key(monkeypatch):
    from app.services import pagos_stripe

    calls = []
    monkeypatch.setattr(pagos_stripe, "stripe_configurado", lambda: True)
    monkeypatch.setattr(
        pagos_stripe.stripe_provider,
        "create_refund",
        lambda **kwargs: calls.append(kwargs) or {"id": "re_mock", "amount": 1750, "status": "succeeded"},
    )
    result = asyncio.run(pagos_stripe.crear_refund(
        payment_intent_id="pi_mock",
        amount=Decimal("17.50"),
        idempotency_key="devolucion:1:25",
    ))

    assert result["id"] == "re_mock"
    assert calls == [{
        "payment_intent": "pi_mock",
        "amount": 1750,
        "idempotency_key": "devolucion:1:25",
        "api_key": pagos_stripe.settings.STRIPE_SECRET_KEY,
    }]
