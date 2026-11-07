"""Focused contract tests for offline sync helpers and endpoint registration."""
import hashlib
import json

import pytest

from app.services.idempotency import body_hash
from app.services.idempotency import replay_if_present
from fastapi import HTTPException, Response
import asyncio
from types import SimpleNamespace


def test_idempotency_hash_is_stable_for_object_key_order():
    assert body_hash({"a": 1, "b": 2}) == body_hash({"b": 2, "a": 1})
    assert body_hash({"a": 1}) == hashlib.sha256(b'{"a":1}').hexdigest()


def test_sync_routes_are_registered():
    from app.main import app

    paths = {(route.path, method) for route in app.routes for method in (getattr(route, "methods", None) or set())}
    assert ("/api/sync/pull", "GET") in paths
    assert ("/api/sync/sales", "POST") in paths
    assert ("/api/sync/push", "POST") in paths


class _Result:
    def __init__(self, row):
        self.row = row

    def scalar_one_or_none(self):
        return self.row


class _Session:
    def __init__(self, row):
        self.row = row
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return _Result(self.row)


def _request(path="/api/sales", key="same-key"):
    return SimpleNamespace(headers={"Idempotency-Key": key}, method="POST",
                           url=SimpleNamespace(path=path))


def test_idempotency_replays_status_and_response_and_scopes_query_to_jwt():
    request = _request()
    row = SimpleNamespace(hashBody=body_hash({"x": 1}), metodo="POST", ruta="/api/sales",
                          status=201, respuesta={"idVenta": 12})
    session = _Session(row)
    response = Response()
    result = asyncio.run(replay_if_present(request, session,
        {"empresa": "42", "sub": "7"}, response, {"x": 1}))
    assert result == {"idVenta": 12}
    assert response.status_code == 201
    assert response.headers["Idempotent-Replayed"] == "true"
    sql = str(session.statement.compile(compile_kwargs={"literal_binds": True}))
    assert '"idEmpresa" = 42' in sql and '"idUser" = 7' in sql


def test_idempotency_rejects_reused_key_with_different_body():
    row = SimpleNamespace(hashBody=body_hash({"x": 1}), metodo="POST", ruta="/api/sales",
                          status=201, respuesta={"idVenta": 12})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(replay_if_present(_request(), _Session(row),
            {"empresa": 42, "sub": 7}, Response(), {"x": 2}))
    assert exc.value.status_code == 409
    assert exc.value.detail == {"code": "idempotency_key_reused"}


def test_idempotency_key_from_other_tenant_is_not_replayed(monkeypatch):
    from sqlalchemy.orm import Session
    from app.models import OperacionIdempotente
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.add(OperacionIdempotente(idOperacion=90001, idEmpresa=2, idUser=7,
            clave="same-key", metodo="POST", ruta="/api/sales", hashBody=body_hash({"x":1}),
            status=201, respuesta={"idVenta":99}))
        db.commit()
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        pending = asyncio.run(replay_if_present(_request(), AsyncSessionAdapter(db),
            {"empresa":1,"sub":7}, Response(), {"x":1}))
    assert isinstance(pending, tuple)
    assert pending[0] == "same-key"


def test_pull_is_tenant_scoped_and_full_without_since(monkeypatch):
    from sqlalchemy.orm import Session
    from app.routers.sync import pull
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        snapshot = asyncio.run(pull(None, AsyncSessionAdapter(db),
            {"sub": "1001", "empresa": 1, "permisos": ["inventario.ver", "venta.ver", "reserva.gestionar"]}))
    assert snapshot["full"] is True
    assert all("tenant-2-" not in repr(row) for key in ("productos", "sucursales", "inventario", "ventas", "reservas") for row in snapshot[key])
    assert snapshot["deleted"] == {"productos": [], "inventario": [], "reservas": []}


def test_customer_pull_includes_branches_and_stock_without_staff_inventory_permission(monkeypatch):
    from sqlalchemy.orm import Session
    from app.routers.sync import pull
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        snapshot = asyncio.run(pull(None, AsyncSessionAdapter(db),
            {"sub":"1001", "empresa":1, "rol":"Cliente", "permisos":["producto.listar", "reserva.crear", "venta.crear"]}))
    assert snapshot["sucursales"]
    assert snapshot["inventario"]
    assert all("tenant-2-" not in repr(row) for key in ("productos", "sucursales", "inventario")
               for row in snapshot[key])


def test_supplier_pull_without_inventory_permission_does_not_include_branches_or_stock(monkeypatch):
    from sqlalchemy.orm import Session
    from app.routers.sync import pull
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        snapshot = asyncio.run(pull(None, AsyncSessionAdapter(db),
            {"sub":"1001", "empresa":1, "rol":"Proveedor", "permisos":["producto.listar"]}))
    assert snapshot["sucursales"] == []
    assert snapshot["inventario"] == []


def test_pull_delta_includes_tenant_tombstones(monkeypatch):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy.orm import Session
    from app.models import SyncBorrado
    from app.routers.sync import pull
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.add(SyncBorrado(idBorrado=1, idEmpresa=1, tabla="producto", idRegistro=987))
        db.commit()
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        delta = asyncio.run(pull(datetime.now(timezone.utc) - timedelta(hours=1), AsyncSessionAdapter(db),
            {"sub": "1001", "empresa": 1, "permisos": ["inventario.ver", "venta.ver", "reserva.gestionar"]}))
    assert delta["full"] is False
    assert 987 in delta["deleted"]["productos"]


def test_offline_sale_rejects_non_cash_with_contract_code():
    from app.routers.sync import sync_sale
    from app.schemas.fase2 import OfflineSaleIn

    payload = OfflineSaleIn.model_validate({
        "idLocal": "b2fa420a-f05f-4793-9b05-2770f0715aef", "comprobanteLocal": "OFF-1",
        "fechaLocal": "2026-10-17T12:00:00Z", "codigoSucursal": 1, "idCliente": 10,
        "pago": {"tipo": "Tarjeta", "monto": 10}, "items": [{"idProducto": 1, "cantidad": 1}],
    })
    with pytest.raises(HTTPException) as exc:
        asyncio.run(sync_sale(payload, _request("/api/sync/sales"), Response(), _Session(None),
                              {"empresa": 1, "sub": 1}))
    assert exc.value.status_code == 422
    assert exc.value.detail == {"code": "offline_payment_not_allowed"}


@pytest.mark.parametrize(
    ("handler_name", "item", "expected"),
    [("sync_sale", {"idProducto": 1001, "cantidad": 0}, {"code": "invalid_quantity"}),
     ("sync_sale", {"idProducto": 987654, "cantidad": 1}, {"code": "product_not_found", "idProducto": 987654}),
     ("_apply_offline_sale", {"idProducto": 1001, "cantidad": 0}, {"code": "invalid_quantity", "idProducto": 1001}),
     ("_apply_offline_sale", {"idProducto": 987654, "cantidad": 1},
      {"code": "product_or_inventory_not_found", "idProducto": 987654})],
)
def test_offline_sale_restores_baseline_quantity_and_product_error_order(
    monkeypatch, handler_name, item, expected
):
    from datetime import datetime, timezone
    from sqlalchemy.orm import Session
    from app.routers import sync as sync_router
    from app.schemas.fase2 import OfflineSaleIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj): return self.session.add(obj)
        async def flush(self): self.session.flush()
        async def commit(self): self.session.commit()

    engine = _test_database(monkeypatch)
    customer_id = _fixture_primary_key(engine, "idCliente", 1)
    branch_id = _fixture_primary_key(engine, "codigoSucursal", 1)
    payload = OfflineSaleIn(
        idLocal="e5fcb289-337b-4095-9ce5-f90d0d5947c4", comprobanteLocal="offline-validation",
        fechaLocal=datetime(2026, 11, 7, tzinfo=timezone.utc), codigoSucursal=branch_id,
        idCliente=customer_id, pago={"tipo": "Efectivo", "monto": 1}, items=[item],
    )
    auth = {"empresa": 1, "sub": "1001", "permisos": ["venta.crear", "venta.ver"]}
    request = _request("/api/sync/sales", "validation-key")

    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        with pytest.raises(HTTPException) as exc:
            if handler_name == "sync_sale":
                asyncio.run(sync_router.sync_sale(payload, request, Response(), Adapter(db), auth))
            else:
                asyncio.run(sync_router._apply_offline_sale(
                    Adapter(db), payload, auth, datetime(2026, 11, 7, tzinfo=timezone.utc)))

    assert exc.value.status_code == 422
    assert exc.value.detail == expected


@pytest.mark.parametrize(("initial_stock", "expected_discrepancy"), [(0, True), (5, False)])
def test_offline_sale_accepts_any_stock_and_replay_does_not_duplicate(monkeypatch, initial_stock, expected_discrepancy):
    from datetime import datetime, timezone
    from sqlalchemy.orm import Session
    from app.models import Inventario, Producto
    from app.routers.sync import sync_sale
    from app.schemas.fase2 import OfflineSaleIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj):
            from app.models import Historial, Movimiento
            if isinstance(obj, Historial) and obj.codigoHistorial is None:
                obj.codigoHistorial = 90001
            if isinstance(obj, Movimiento) and obj.idMov is None:
                obj.idMov = 90001
            return self.session.add(obj)
        async def flush(self): self.session.flush()
        async def commit(self): self.session.commit()

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        product_id = _fixture_primary_key(engine, "idProducto", 1)
        customer_id = _fixture_primary_key(engine, "idCliente", 1)
        inv = db.query(Inventario).filter_by(idEmpresa=1).one()
        db.info.update(tenant_scoped=False, tenant_id=None)
        inv.cantidad_actual = initial_stock
        product = db.get(Producto, product_id)
        amount = float(product.venta)
        db.commit()

    payload = OfflineSaleIn(idLocal="b2fa420a-f05f-4793-9b05-2770f0715aef",
        comprobanteLocal="OFF-1", fechaLocal=datetime.now(timezone.utc), codigoSucursal=1001,
        idCliente=customer_id, pago={"tipo":"Efectivo", "monto":amount},
        items=[{"idProducto":product_id, "cantidad":1}])
    request = _request("/api/sync/sales", "offline-sale-uuid")
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        first_response = Response()
        first = asyncio.run(sync_sale(payload, request, first_response, Adapter(db),
            {"empresa":1,"sub":1001,"permisos":["venta.crear"]}))
    assert first["discrepanciaStock"] is expected_discrepancy
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        replay_response = Response()
        replay = asyncio.run(sync_sale(payload, request, replay_response, Adapter(db),
            {"empresa":1,"sub":1001,"permisos":["venta.crear"]}))
        final_stock = db.query(Inventario).filter_by(idEmpresa=1).one().cantidad_actual
    assert replay["idVenta"] == first["idVenta"]
    assert replay_response.headers["Idempotent-Replayed"] == "true"
    assert final_stock == initial_stock - 1


def test_online_sale_still_rejects_insufficient_stock(monkeypatch):
    from starlette.background import BackgroundTasks
    from sqlalchemy.orm import Session
    from app.models import Inventario, MetodoPago
    from app.routers.sales import create_sale
    from app.schemas.fase2 import VentaIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj): return self.session.add(obj)
        async def flush(self): self.session.flush()
        async def commit(self): self.session.commit()

    engine = _test_database(monkeypatch)
    product_id = _fixture_primary_key(engine, "idProducto", 1)
    customer_id = _fixture_primary_key(engine, "idCliente", 1)
    with Session(engine) as db:
        inventory = db.query(Inventario).filter_by(idEmpresa=1).one()
        method = db.query(MetodoPago).filter_by(idEmpresa=1).one()
        db.info.update(tenant_scoped=False, tenant_id=None)
        inventory.cantidad_actual = 0
        method.consumidoEn = None
        method_id = method.idMetPago
        branch_id = inventory.codigoSucursal
        db.commit()
    request = SimpleNamespace(headers={}, method="POST", url=SimpleNamespace(path="/api/sales"),
                              client=SimpleNamespace(host="127.0.0.1"))
    payload = VentaIn(idCliente=customer_id, idMetPago=method_id, codigoSucursal=branch_id,
                      items=[{"idProducto":product_id, "cantidad":1}])
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(create_sale(payload, request, Response(), BackgroundTasks(),
                Adapter(db), {"empresa":1,"sub":1001,"permisos":["venta.crear","venta.ver"]}))
    assert exc.value.status_code == 400
    assert "Stock insuficiente" in exc.value.detail


def test_stripe_payment_amount_must_match_priced_sale_total(monkeypatch):
    from starlette.background import BackgroundTasks
    from sqlalchemy.orm import Session
    from app.models import Inventario, MetodoPago
    from app.routers.sales import create_sale
    from app.routers import sales
    from app.schemas.fase2 import VentaIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj): return self.session.add(obj)
        async def flush(self): self.session.flush()
        async def commit(self): self.session.commit()

    engine = _test_database(monkeypatch)
    product_id = _fixture_primary_key(engine, "idProducto", 1)
    customer_id = _fixture_primary_key(engine, "idCliente", 1)
    with Session(engine) as db:
        inventory = db.query(Inventario).filter_by(idEmpresa=1).one()
        method = db.query(MetodoPago).filter_by(idEmpresa=1).one()
        db.info.update(tenant_scoped=False, tenant_id=None)
        method.origen = "tarjeta_stripe"
        method.monto = 1
        method.consumidoEn = None
        method_id = method.idMetPago
        branch_id = inventory.codigoSucursal
        db.commit()

    payload = VentaIn(idCliente=customer_id, idMetPago=method_id, codigoSucursal=branch_id,
                      items=[{"idProducto": product_id, "cantidad": 1}])
    async def intent_metadata(_intent_id):
        return {"metadata": {"idCliente": str(customer_id), "codigoCupon": "", "puntos": "0"}}
    monkeypatch.setattr(sales, "obtener_payment_intent", intent_metadata)
    request = SimpleNamespace(headers={}, method="POST", url=SimpleNamespace(path="/api/sales"),
                              client=SimpleNamespace(host="127.0.0.1"))
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(create_sale(payload, request, Response(), BackgroundTasks(),
                Adapter(db), {"empresa": 1, "sub": 1001, "permisos": ["venta.crear", "venta.ver"]}))
    assert exc.value.status_code == 409
    assert exc.value.detail == "El monto cobrado no coincide con el total de la venta"


@pytest.mark.parametrize(("coupon", "points"), [("AHORRO", None), (None, 10)])
def test_offline_sync_rejects_coupon_or_points_payload(coupon, points):
    from datetime import datetime, timezone
    from uuid import uuid4
    from app.routers.sync import sync_sale
    from app.schemas.fase2 import OfflineSaleIn

    payload = OfflineSaleIn(
        idLocal=uuid4(), comprobanteLocal="offline-1",
        fechaLocal=datetime(2026, 11, 7, tzinfo=timezone.utc), codigoSucursal=1,
        idCliente=1, pago={"tipo": "Efectivo", "monto": 10},
        items=[{"idProducto": 1, "cantidad": 1}], codigoCupon=coupon, puntos=points,
    )
    request = SimpleNamespace(headers={"Idempotency-Key": "offline-key"})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(sync_sale(payload, request, Response(), object(),
                              {"empresa": 1, "sub": 1, "permisos": ["venta.crear"]}))

    assert exc.value.status_code == 422
    assert exc.value.detail == {"code": "offline_coupon_or_points_not_allowed"}


def test_offline_sale_uses_active_promotion_price(monkeypatch):
    from datetime import datetime, timezone
    from sqlalchemy.orm import Session
    from app.models import Inventario, Producto, Promocion
    from app.routers.sync import _apply_offline_sale
    from app.schemas.fase2 import OfflineSaleIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj):
            from app.models import Historial, Movimiento
            if isinstance(obj, Historial) and obj.codigoHistorial is None:
                obj.codigoHistorial = 99001
            if isinstance(obj, Movimiento) and obj.idMov is None:
                obj.idMov = 99001
            return self.session.add(obj)

        async def flush(self):
            self.session.flush()

    engine = _test_database(monkeypatch)
    product_id = _fixture_primary_key(engine, "idProducto", 1)
    customer_id = _fixture_primary_key(engine, "idCliente", 1)
    branch_id = _fixture_primary_key(engine, "codigoSucursal", 1)
    with Session(engine) as db:
        db.info.update(tenant_scoped=False, tenant_id=None)
        product = db.get(Producto, product_id)
        product_price = float(product.venta)
        inventory = db.query(Inventario).filter_by(idEmpresa=1, idProducto=product_id).one()
        inventory.cantidad_actual = 5
        inventory.cantidad_reservada = 0
        db.add(Promocion(
            idPromocion=99001, idEmpresa=1, nombre="Descuento offline", tipo="porcentaje", valor=20,
            alcance="todos", activa=True,
            fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
            fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
        ))
        db.commit()

    payload = OfflineSaleIn(
        idLocal="92345678-1234-1234-1234-123456789012", comprobanteLocal="offline-promo",
        fechaLocal=datetime(2026, 11, 7, tzinfo=timezone.utc), codigoSucursal=branch_id,
        idCliente=customer_id,
        pago={"tipo": "Efectivo", "monto": round(product_price * 0.8, 2)},
        items=[{"idProducto": product_id, "cantidad": 1}],
    )

    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        result = asyncio.run(_apply_offline_sale(
            Adapter(db), payload,
            {"empresa": 1, "sub": "1001", "permisos": ["venta.crear", "venta.ver"]},
            datetime(2026, 11, 7, tzinfo=timezone.utc),
        ))

    assert result["status"] == "synced"
    assert result["venta"]["total"] == round(product_price * 0.8, 2)
    assert result["venta"]["detalles"][0]["precio_unitario"] == round(product_price * 0.8, 2)


def test_reservation_confirmation_ignores_promotion_and_records_points(monkeypatch):
    from datetime import date, datetime, timezone
    from sqlalchemy.orm import Session
    from app.models import CuentaPuntos, Inventario, MetodoPago, Producto, Promocion, Reserva
    from app.routers.reservations import confirm_reservation
    from app.schemas.fase2 import ReservaConfirmarIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    class Adapter(AsyncSessionAdapter):
        def add(self, obj):
            from app.models import Bitacora, Historial, Movimiento
            if isinstance(obj, (Bitacora, Historial, Movimiento)):
                for key in ("idBitacora", "codigoHistorial", "idMov"):
                    if hasattr(obj, key) and getattr(obj, key) is None:
                        setattr(obj, key, 99101)
                        break
            return self.session.add(obj)

        async def flush(self):
            self.session.flush()

        async def commit(self):
            self.session.commit()

        async def refresh(self, obj):
            self.session.refresh(obj)

    engine = _test_database(monkeypatch)
    reservation_id = _fixture_primary_key(engine, "codigoReserva", 1)
    with Session(engine) as db:
        db.info.update(tenant_scoped=False, tenant_id=None)
        reservation = db.get(Reserva, reservation_id)
        product = db.get(Producto, reservation.idProducto)
        product.venta = 100
        reservation.estado = "Preparada en Sucursal"
        reservation.fecha = date(2026, 11, 7)
        reservation.montoDeposito = 20
        method = db.query(MetodoPago).filter_by(idEmpresa=1).one()
        method.consumidoEn = None
        inventory = db.query(Inventario).filter_by(
            idEmpresa=1, codigoSucursal=reservation.codigoSucursal, idProducto=reservation.idProducto,
        ).one()
        inventory.cantidad_actual = 5
        inventory.cantidad_reservada = 1
        account = db.query(CuentaPuntos).filter_by(idCliente=reservation.idCliente).one()
        account.saldo = 0
        account.acumulado_historico = 5000
        db.add(Promocion(
            idPromocion=99101, idEmpresa=1, nombre="No aplica a reserva", tipo="porcentaje", valor=50,
            alcance="todos", activa=True,
            fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
            fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
        ))
        method_id = method.idMetPago
        customer_id = reservation.idCliente
        product_id = reservation.idProducto
        branch_id = reservation.codigoSucursal
        db.commit()

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        result = asyncio.run(confirm_reservation(
            reservation_id, ReservaConfirmarIn(idMetPago=method_id), request,
            Adapter(db), {"empresa": 1, "sub": "1001", "permisos": ["reserva.gestionar"]},
        ))
        from app.models import DetalleVenta, Venta
        sale = db.query(Venta).filter_by(idCliente=customer_id).order_by(Venta.idVenta.desc()).first()
        detail = db.query(DetalleVenta).filter_by(idVenta=sale.idVenta).one()
        account = db.get(CuentaPuntos, customer_id)

    assert result.total == 80
    assert sale.total == 80
    assert detail.precio_unitario == detail.precio_lista == 100
    assert detail.cantidad * detail.precio_unitario == 100
    assert sale.puntos_ganados == 12
    assert account.saldo == 12


def test_promotion_management_requires_permission():
    from fastapi.testclient import TestClient
    from app.database import get_tenant_db
    from app.main import app
    from app.security import get_current_payload

    async def no_db():
        yield None

    app.dependency_overrides[get_tenant_db] = no_db
    app.dependency_overrides[get_current_payload] = lambda: {
        "empresa": 1, "sub": "1001", "permisos": [],
    }
    try:
        with TestClient(app) as client:
            response = client.get("/api/promotions")
    finally:
        app.dependency_overrides.pop(get_tenant_db, None)
        app.dependency_overrides.pop(get_current_payload, None)

    assert response.status_code == 403
    assert response.json()["detail"] == "No tiene permiso 'promocion.gestionar'"


def test_reservation_stock_failure_preserves_http_400_with_code(monkeypatch):
    from datetime import date
    from sqlalchemy.orm import Session
    from app.models import Inventario, MetodoPago
    from app.routers.reservations import create_reservation
    from app.schemas.fase2 import ReservaIn
    from tests.test_multitenant_route_isolation import (
        _test_database, _fixture_primary_key, AsyncSessionAdapter,
    )

    engine = _test_database(monkeypatch)
    product_id = _fixture_primary_key(engine, "idProducto", 1)
    customer_id = _fixture_primary_key(engine, "idCliente", 1)
    with Session(engine) as db:
        inventory = db.query(Inventario).filter_by(idEmpresa=1).one()
        method = db.query(MetodoPago).filter_by(idEmpresa=1).one()
        db.info.update(tenant_scoped=False, tenant_id=None)
        inventory.cantidad_actual = 0
        method.consumidoEn = None
        branch_id = inventory.codigoSucursal
        method_id = method.idMetPago
        db.commit()
    payload = ReservaIn(fecha=date(2026, 10, 18), horario="12:00", idCliente=customer_id,
                        codigoSucursal=branch_id, idProducto=product_id, idMetPago=method_id)
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(create_reservation(payload, _request("/api/reservations"), Response(),
                AsyncSessionAdapter(db), {"empresa":1,"sub":1001,
                  "permisos":["reserva.crear","reserva.gestionar"]}))
    assert exc.value.status_code == 400
    assert exc.value.detail == {"code":"stock_insufficient", "idProducto":product_id}


def test_discrepancy_filter_and_resolution(monkeypatch):
    from sqlalchemy.orm import Session
    from app.models import Venta
    from app.routers.sales import list_sales, resolve_discrepancy
    from app.schemas.fase2 import ResolveDiscrepancyIn
    from tests.test_multitenant_route_isolation import _test_database, AsyncSessionAdapter

    class Adapter(AsyncSessionAdapter):
        async def commit(self): self.session.commit()

    engine = _test_database(monkeypatch)
    with Session(engine) as db:
        sale = db.query(Venta).filter_by(idEmpresa=1).one()
        db.info.update(tenant_scoped=False, tenant_id=None)
        sale.discrepanciaStock = True
        sale_id = sale.idVenta
        db.commit()
    with Session(engine) as db:
        db.info.update(tenant_scoped=True, tenant_id=1)
        results = asyncio.run(list_sales(None, True, Adapter(db),
            {"sub":"1001","permisos":["venta.ver"]}))
        assert len(results) == 1 and results[0].discrepanciaStock is True
        resolution = asyncio.run(resolve_discrepancy(sale_id,
            ResolveDiscrepancyIn(nota="Reviewed"), Adapter(db), None))
    assert resolution["discrepanciaNota"] == "Reviewed"
