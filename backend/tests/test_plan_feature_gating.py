"""Plan feature enforcement contracts for backend routes."""

import json
import sqlite3
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_tenant_db
from app.main import app
from app.models import Empresa, MedidaProducto, Plan, Producto, Promocion, Suscripcion
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

    async def commit(self):
        self.session.commit()

    async def refresh(self, instance):
        self.session.refresh(instance)

    async def flush(self):
        self.session.flush()


@pytest.fixture
def plan_api(monkeypatch):
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
    with Session(engine) as session:
        session.add(Empresa(idEmpresa=1, nombre="Tienda", slug="tienda", estado="Activa"))
        session.add_all([
            Plan(idPlan=1, codigo="basico", nombre="Básico", precioMensual=0,
                 precioAnual=0, features=["pos", "inventario", "ventas", "reportes"], limites={}),
            Plan(idPlan=2, codigo="avanzado", nombre="Profesional", precioMensual=0,
                 precioAnual=0, features=["pos", "inventario", "ventas", "reportes", "despachos",
                                          "reservas", "pagos_online", "app_movil", "reportes_avanzados",
                                          "reportes_export", "ia", "probador", "promociones",
                                          "fidelizacion", "tallas"], limites={}),
        ])
        session.add(Suscripcion(
            idSuscripcion=1, idEmpresa=1, idPlan=1, estado="activa", fechaInicio=date.today(),
        ))
        session.add(Producto(
            idProducto=1, idEmpresa=1, nombre="Camisa", costo=10, venta=20,
            idProveedor=1, idColeccion=1,
        ))
        session.add(MedidaProducto(idEmpresa=1, idProducto=1, talla="M", pecho=100))
        session.add(Promocion(
            idPromocion=1, idEmpresa=1, nombre="Promo", tipo="porcentaje", valor=10,
            alcance="todos", activa=True,
            fecha_inicio=datetime(2026, 1, 1, tzinfo=timezone.utc),
            fecha_fin=datetime(2027, 1, 1, tzinfo=timezone.utc),
        ))
        session.commit()

    async def tenant_session(payload=Depends(get_current_payload)):
        with Session(engine) as session:
            session.info.update(tenant_scoped=True, tenant_id=int(payload["empresa"]))
            yield AsyncSessionAdapter(session)

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_tenant_db] = tenant_session
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, engine=engine)
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def _headers():
    token = create_access_token(10, {
        "empresa": 1,
        "rol": "Administrador",
        "permisos": ["promocion.gestionar", "venta.crear", "venta.ver", "producto.editar", "reporte.ver"],
    })
    return {"Authorization": f"Bearer {token}"}


PROMOTION = {
    "nombre": "Oferta",
    "tipo": "porcentaje",
    "valor": 10,
    "fecha_inicio": "2026-01-01T00:00:00Z",
    "fecha_fin": "2027-01-01T00:00:00Z",
}
COUPON = {
    "codigo": "OFERTA",
    "tipo": "porcentaje",
    "valor": 10,
    "fecha_inicio": "2026-01-01T00:00:00Z",
    "fecha_fin": "2027-01-01T00:00:00Z",
}


@pytest.mark.parametrize(
    ("method", "path", "feature", "kwargs"),
    [
        ("get", "/api/promotions", "promociones", {}),
        ("post", "/api/promotions", "promociones", {"json": PROMOTION}),
        ("put", "/api/promotions/1", "promociones", {"json": PROMOTION}),
        ("delete", "/api/promotions/1", "promociones", {}),
        ("get", "/api/coupons", "promociones", {}),
        ("post", "/api/coupons", "promociones", {"json": COUPON}),
        ("put", "/api/coupons/1", "promociones", {"json": COUPON}),
        ("delete", "/api/coupons/1", "promociones", {}),
        ("get", "/api/loyalty/me", "fidelizacion", {}),
        ("get", "/api/loyalty/customers/1", "fidelizacion", {}),
        ("get", "/api/products/1/size-recommendation", "tallas", {}),
        ("post", "/api/products/1/fit-feedback", "tallas", {"json": {"resultado": "bien"}}),
        ("get", "/api/fit-feedback/mine", "tallas", {}),
        ("get", "/api/fit-feedback/summary", "tallas", {}),
        ("put", "/api/products/1/size-chart", "tallas", {"json": {"tallas": []}}),
        ("post", "/api/products/visual-search", "ia", {"files": {"imagen": ("image.png", b"image", "image/png")}}),
        ("post", "/api/products/visual-search/reindex", "ia", {}),
        ("get", "/api/dashboard/ml/sales-forecast", "ia", {}),
        ("get", "/api/dashboard/ml/stockout-risk", "ia", {}),
        ("get", "/api/dashboard/ml/product-trends", "ia", {}),
        ("get", "/api/dashboard/ml/customer-segments", "ia", {}),
        ("post", "/api/reports/ai", "ia", {"json": {"prompt": "ventas"}}),
        ("post", "/api/reports/ai/csv", "ia", {"json": {"prompt": "ventas"}}),
        ("post", "/api/reports/ai/transcribe", "ia", {"files": {"audio": ("audio.wav", b"audio", "audio/wav")}}),
    ],
)
def test_basico_is_denied_on_feature_routes(plan_api, method, path, feature, kwargs):
    response = getattr(plan_api.client, method)(path, headers=_headers(), **kwargs)

    assert response.status_code == 403
    assert response.json()["detail"] == {"code": "feature_not_in_plan", "feature": feature}


def test_public_storefront_reads_stay_neutral_for_basico(plan_api):
    headers = _headers()

    promotions = plan_api.client.get("/api/promotions/active", headers=headers)
    size_chart = plan_api.client.get("/api/products/1/size-chart", headers=headers)

    assert promotions.status_code == 200
    assert promotions.json() == []
    assert size_chart.status_code == 200
    assert size_chart.json()["fuente"] == "generica"
    assert size_chart.json()["tallas"]


def test_advanced_plan_keeps_promotion_management_working(plan_api):
    with Session(plan_api.engine) as session:
        subscription = session.get(Suscripcion, 1)
        subscription.idPlan = 2
        session.commit()

    response = plan_api.client.post("/api/promotions", headers=_headers(), json=PROMOTION)

    assert response.status_code == 201, response.text
    assert response.json()["nombre"] == "Oferta"


def test_basic_quote_ignores_coupon_and_points_and_keeps_list_price(plan_api):
    response = plan_api.client.post("/api/sales/quote", headers=_headers(), json={
        "items": [{"idProducto": 1, "cantidad": 1}],
        "idCliente": 101,
        "codigoCupon": "OFERTA",
        "puntos": 100,
    })

    assert response.status_code == 200, response.text
    assert response.json()["total"] == 20
    assert response.json()["descuento_promociones"] == 0
    assert response.json()["descuento_cupon"] == 0
    assert response.json()["descuento_puntos"] == 0
    assert response.json()["puntos_canjeados"] == 0
    assert response.json()["puntos_a_ganar"] == 0
