"""CU37/CU43 shared pricing and points rules."""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import BigInteger, create_engine, null
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    Cliente,
    Colecciones,
    Cupon,
    CuponUso,
    CuentaPuntos,
    Devolucion,
    DevolucionDetalle,
    DetalleVenta,
    Empresa,
    MovimientoPuntos,
    MetodoPago,
    Producto,
    Promocion,
    Proveedor,
    Temporada,
)
from app.services.pricing import (
    aplicar_puntos_devolucion,
    cotizar,
    nivel_puntos,
    registrar_puntos_venta,
    registrar_uso_cupon,
)


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(_type, _compiler, **_kw):
    return "JSON"


@compiles(INET, "sqlite")
def _compile_inet_sqlite(_type, _compiler, **_kw):
    return "VARCHAR(64)"


@compiles(BigInteger, "sqlite")
def _compile_bigint_sqlite(_type, _compiler, **_kw):
    return "INTEGER"


class _AsyncSessionAdapter:
    def __init__(self, session):
        self.session = session

    async def execute(self, *args, **kwargs):
        return self.session.execute(*args, **kwargs)

    async def get(self, *args, **kwargs):
        return self.session.get(*args, **kwargs)

    def add(self, value):
        self.session.add(value)

    async def flush(self):
        self.session.flush()

    async def commit(self):
        self.session.commit()

    async def refresh(self, value):
        self.session.refresh(value)

    async def rollback(self):
        self.session.rollback()


@pytest.fixture
def pricing_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Empresa(idEmpresa=1, nombre="Tienda", slug="tienda", estado="Activa"))
        session.add(Proveedor(idProveedor=1, idEmpresa=1, nombre="Proveedor"))
        session.add(Temporada(
            idTemporada=1,
            idEmpresa=1,
            nombreTemporada="Temporada actual",
            fecha_ini=datetime(2026, 1, 1).date(),
            fecha_fin=datetime(2027, 1, 1).date(),
        ))
        session.add(Colecciones(
            idColeccion=1,
            idEmpresa=1,
            nombre_coleccion="Colección base",
            idTemporada=1,
        ))
        session.add(Cliente(idCliente=101, idEmpresa=1, idUser=10, nombre="Cliente"))
        session.add(Producto(
            idProducto=1,
            idEmpresa=1,
            nombre="Camisa",
            costo=Decimal("5.00"),
            venta=Decimal("100.00"),
            tipo="Camisa",
            idProveedor=1,
            idColeccion=1,
            imagenes_secundarias=null(),
        ))
        session.add(Producto(
            idProducto=2,
            idEmpresa=1,
            nombre="Pantalón",
            costo=Decimal("5.00"),
            venta=Decimal("10.05"),
            tipo="Pantalón",
            idProveedor=1,
            idColeccion=1,
            imagenes_secundarias=null(),
        ))
        session.add(CuentaPuntos(
            idCliente=101,
            idEmpresa=1,
            saldo=1000,
            acumulado_historico=5000,
        ))
        session.commit()
        yield _AsyncSessionAdapter(session)
    engine.dispose()


def _run_quote(session, items, *, coupon=None, points=0, channel="online"):
    return asyncio.run(cotizar(
        session,
        tenant_id=1,
        items=items,
        id_cliente=101,
        codigo_cupon=coupon,
        puntos=points,
        fecha=datetime(2026, 11, 7, tzinfo=timezone.utc),
        canal=channel,
    ))


@pytest.mark.parametrize(
    ("earned", "level", "multiplier", "next_level", "points_to_next"),
    [
        (0, "Bronce", 1.0, "Plata", 2000),
        (1999, "Bronce", 1.0, "Plata", 1),
        (2000, "Plata", 1.25, "Oro", 3000),
        (4999, "Plata", 1.25, "Oro", 1),
        (5000, "Oro", 1.5, None, 0),
    ],
)
def test_level_thresholds_and_multipliers(earned, level, multiplier, next_level, points_to_next):
    assert nivel_puntos(earned) == {
        "nivel": level,
        "multiplicador": multiplier,
        "siguiente_nivel": next_level,
        "puntos_para_siguiente": points_to_next,
    }


def test_quote_uses_best_per_line_coupon_points_cap_and_exact_line_invariant(pricing_session):
    pricing_session.add(Promocion(
        idPromocion=1, idEmpresa=1, nombre="10%", tipo="porcentaje", valor=10,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.add(Promocion(
        idPromocion=2, idEmpresa=1, nombre="Fijo 8", tipo="monto_fijo", valor=8,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.add(Cupon(
        idCupon=1, idEmpresa=1, codigo="MITAD", tipo="porcentaje", valor=50,
        minimo_compra=0, fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc), activo=True,
        un_uso_por_cliente=True,
    ))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 2}], coupon="mitad", points=1000)

    assert quote["lineas"][0]["idPromocion"] == 1
    assert quote["subtotal"] == 200.0
    assert quote["descuento_promociones"] == 20.0
    assert quote["descuento_cupon"] == 90.0
    assert quote["descuento_puntos"] == 45.0
    assert quote["puntos_canjeados"] == 450
    assert quote["total"] == 45.0
    assert round(sum(line["precio_unitario"] * line["cantidad"] for line in quote["lineas"]), 2) == quote["total"]


def test_quote_rounds_money_to_cents_and_returns_invalid_coupon_as_notice(pricing_session):
    quote = _run_quote(pricing_session, [{"idProducto": 2, "cantidad": 3}], coupon="NO-EXISTE")

    assert quote["avisos"] == ["Cupón inválido o vencido"]
    assert quote["descuento_cupon"] == 0
    assert quote["total"] == 30.15
    assert round(sum(line["precio_unitario"] * line["cantidad"] for line in quote["lineas"]), 2) == quote["total"]


def test_active_promotions_resolve_product_ids_for_each_scope(pricing_session):
    from app.routers.promotions import active_promotions

    starts = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ends = datetime(2027, 1, 1, tzinfo=timezone.utc)
    scopes = [("todos", None, None), ("producto", "1", [1]),
              ("coleccion", "1", [1, 2]), ("temporada", "1", [1, 2]),
              ("tipo", "camisa", [1])]
    for index, (scope, ref, _) in enumerate(scopes, start=40):
        pricing_session.add(Promocion(
            idPromocion=index, idEmpresa=1, nombre=f"Promo {scope}", tipo="porcentaje", valor=10,
            alcance=scope, alcance_ref=ref, activa=True, fecha_inicio=starts, fecha_fin=ends))
    pricing_session.session.flush()

    result = asyncio.run(active_promotions(pricing_session, {"empresa": 1}))

    assert {row["idPromocion"]: row["productos"] for row in result} == {
        index: expected for index, (_, _, expected) in enumerate(scopes, start=40)}


def test_return_clamping_points_to_zero_is_recorded_in_movement_note(pricing_session):
    from app.models import Venta

    account = pricing_session.session.get(CuentaPuntos, 101)
    account.saldo = 2
    sale = Venta(idVenta=41, idEmpresa=1, idCliente=101, idMetPago=30, total=100,
                 puntos_ganados=10, puntos_canjeados=0)
    pricing_session.add(sale)
    pricing_session.add(DetalleVenta(codigoVenta=51, idEmpresa=1, cantidad=1, precio_unitario=100,
                                    idProducto=1, idVenta=41))
    record = Devolucion(idDevolucion=61, idEmpresa=1, idVenta=41, idUser=10,
                        tipo="devolucion", estado="payment_pending", montoReembolso=100,
                        montoCobrado=0)
    returned = DevolucionDetalle(id=71, idEmpresa=1, return_id=61, sale_item_id=51,
                                 quantity=1, unit_price=100, inventory_id=1)
    pricing_session.add(record)
    pricing_session.add(returned)
    pricing_session.session.flush()

    asyncio.run(aplicar_puntos_devolucion(pricing_session, 1, sale, record, [returned]))
    pricing_session.session.flush()

    movement = pricing_session.session.query(MovimientoPuntos).filter_by(
        idVenta=41, tipo="revertido").one()
    assert pricing_session.session.get(CuentaPuntos, 101).saldo == 0
    assert "cero" in movement.nota.lower()


def test_duplicate_coupon_returns_conflict(pricing_session):
    from app.routers.promotions import create_coupon
    from app.schemas.promotions import CuponIn

    pricing_session.add(_coupon())
    pricing_session.session.flush()
    payload = CuponIn(codigo=" test ", tipo="porcentaje", valor=10,
                      fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
                      fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc))

    with pytest.raises(__import__("fastapi").HTTPException) as exc:
        asyncio.run(create_coupon(payload, pricing_session,
            {"empresa": 1, "permisos": ["promocion.gestionar"]}))

    assert exc.value.status_code == 409
    assert exc.value.detail == "Ya existe un cupón con ese código"


def _coupon(**overrides):
    values = {
        "idCupon": 10, "idEmpresa": 1, "codigo": "TEST", "tipo": "porcentaje",
        "valor": 10, "minimo_compra": 0,
        "fecha_inicio": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "fecha_fin": datetime(2027, 1, 1, tzinfo=timezone.utc),
        "un_uso_por_cliente": True, "activo": True,
    }
    values.update(overrides)
    return Cupon(**values)


@pytest.mark.parametrize(
    ("coupon", "expected_notice"),
    [
        (_coupon(minimo_compra=500), "No alcanza el mínimo de compra"),
        (_coupon(fecha_fin=datetime(2026, 1, 2, tzinfo=timezone.utc)), "Cupón inválido o vencido"),
        (_coupon(idCliente=999), "Cupón inválido o vencido"),
        (_coupon(usos_maximos=1), "Cupón inválido o vencido"),
        (_coupon(), "Ya usaste este cupón"),
    ],
)
def test_coupon_limits_and_invalid_reasons(pricing_session, coupon, expected_notice):
    pricing_session.add(coupon)
    if coupon.usos_maximos == 1:
        pricing_session.add(CuponUso(
            idEmpresa=1, idCupon=coupon.idCupon, idVenta=900, idCliente=102,
            fecha=datetime(2026, 3, 1, tzinfo=timezone.utc),
        ))
    if coupon.idCliente is None and coupon.un_uso_por_cliente and coupon.usos_maximos is None:
        pricing_session.add(CuponUso(
            idEmpresa=1, idCupon=coupon.idCupon, idVenta=901, idCliente=101,
            fecha=datetime(2026, 3, 1, tzinfo=timezone.utc),
        ))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 1}], coupon="TEST")

    assert quote["idCupon"] is None
    assert expected_notice in quote["avisos"]
    assert quote["descuento_cupon"] == 0


def test_offline_quote_applies_promotions_but_no_coupon_or_redemption(pricing_session):
    pricing_session.add(Promocion(
        idPromocion=21, idEmpresa=1, nombre="Oferta offline", tipo="porcentaje", valor=20,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.add(_coupon(idCupon=21, codigo="ONLINE"))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 1}], coupon="ONLINE", points=200,
                       channel="offline")

    assert quote["total"] == 80
    assert quote["idCupon"] is None
    assert quote["descuento_cupon"] == 0
    assert quote["puntos_canjeados"] == 0
    assert quote["puntos_a_ganar"] == 12


@pytest.mark.parametrize(
    ("scope", "reference"),
    [("producto", "1"), ("coleccion", "1"), ("temporada", "1"), ("tipo", "camisa")],
)
def test_promotion_scopes_match_only_their_product_scope(pricing_session, scope, reference):
    pricing_session.add(Promocion(
        idPromocion=30, idEmpresa=1, nombre=f"Alcance {scope}", tipo="porcentaje", valor=20,
        alcance=scope, alcance_ref=reference, activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 1}])

    assert quote["lineas"][0]["idPromocion"] == 30
    assert quote["total"] == 80


def test_nxm_promotion_and_tenant_isolation(pricing_session):
    pricing_session.add(Promocion(
        idPromocion=31, idEmpresa=1, nombre="2x1", tipo="nxm", valor=None, n=2, m=1,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.add(Promocion(
        idPromocion=32, idEmpresa=2, nombre="Otro tenant", tipo="porcentaje", valor=90,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 2}])

    assert quote["lineas"][0]["idPromocion"] == 31
    assert quote["descuento_promociones"] == 100
    assert quote["total"] == 100


def test_reservation_channel_ignores_promotions_and_coupon_but_awards_points(pricing_session):
    pricing_session.add(Promocion(
        idPromocion=33, idEmpresa=1, nombre="No en reserva", tipo="porcentaje", valor=50,
        alcance="todos", activa=True,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
    ))
    pricing_session.add(_coupon(idCupon=33, codigo="NO-RESERVA"))
    pricing_session.session.commit()

    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 1}], coupon="NO-RESERVA",
                       points=500, channel="reserva")

    assert quote["total"] == 100
    assert quote["lineas"][0]["idPromocion"] is None
    assert quote["idCupon"] is None
    assert quote["puntos_canjeados"] == 0
    assert quote["puntos_a_ganar"] == 15


def test_quote_and_ledger_use_customer_tier_and_apply_points_atomically(pricing_session):
    quote = _run_quote(pricing_session, [{"idProducto": 1, "cantidad": 1}], points=100)
    assert quote["puntos_a_ganar"] == 13

    asyncio.run(registrar_uso_cupon(pricing_session, quote, 1, 101, 55,
                                    datetime(2026, 11, 7, tzinfo=timezone.utc)))
    asyncio.run(registrar_puntos_venta(pricing_session, quote, 1, 101, 55,
                                       datetime(2026, 11, 7, tzinfo=timezone.utc)))
    pricing_session.session.flush()

    account = pricing_session.session.get(CuentaPuntos, 101)
    assert account.saldo == 913  # 1,000 - 100 redeemed + 13 earned
    assert account.acumulado_historico == 5013


def test_points_rounding_never_exceeds_the_fifty_percent_cap(pricing_session):
    product_one = pricing_session.session.get(Producto, 1)
    product_two = pricing_session.session.get(Producto, 2)
    product_one.venta = Decimal("10.01")
    product_two.venta = Decimal("100.13")
    account = pricing_session.session.get(CuentaPuntos, 101)
    account.saldo = 2000
    account.acumulado_historico = 0
    pricing_session.session.flush()

    quote = _run_quote(pricing_session, [
        {"idProducto": 1, "cantidad": 1}, {"idProducto": 2, "cantidad": 3},
    ], points=1552)

    assert quote["subtotal"] == 310.40
    assert quote["descuento_puntos"] <= 155.20
    assert quote["total"] >= 155.20
    assert round(sum(line["precio_unitario"] * line["cantidad"] for line in quote["lineas"]), 2) == quote["total"]


def test_return_reverses_earned_points_and_restores_redeemed_points(pricing_session):
    from app.models import Venta

    sale = Venta(idVenta=40, idEmpresa=1, idCliente=101, idMetPago=30, total=100,
                 puntos_ganados=10, puntos_canjeados=10)
    pricing_session.add(sale)
    pricing_session.add(DetalleVenta(codigoVenta=50, idEmpresa=1, cantidad=2, precio_unitario=50,
                                    idProducto=1, idVenta=40))
    record = Devolucion(idDevolucion=60, idEmpresa=1, idVenta=40, idUser=10,
                        tipo="devolucion", estado="payment_pending", montoReembolso=50,
                        montoCobrado=0)
    pricing_session.add(record)
    returned = DevolucionDetalle(id=70, idEmpresa=1, return_id=60, sale_item_id=50,
                                 quantity=1, unit_price=50, inventory_id=1)
    pricing_session.add(returned)
    pricing_session.session.flush()

    asyncio.run(aplicar_puntos_devolucion(pricing_session, 1, sale, record, [returned]))
    pricing_session.session.flush()

    account = pricing_session.session.get(CuentaPuntos, 101)
    assert account.saldo == 1000  # Existing 1,000 balance - 5 earned reversed + 5 redeemed restored.
    movements = pricing_session.session.query(MovimientoPuntos).filter_by(idVenta=40).all()
    assert {(movement.tipo, movement.puntos) for movement in movements} == {
        ("revertido", -5), ("devuelto", 5),
    }
