"""CU35 size recommendation contract tests."""

import json
import sqlite3
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
from app.models import Cliente, DetalleVenta, Producto, Usuario, Venta
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

    def add(self, instance):
        self.session.add(instance)

    async def commit(self):
        self.session.commit()


@pytest.fixture
def recommendation_env(monkeypatch):
    import app.database as database

    monkeypatch.setattr(database, "_set_local_tenant_context", lambda *_args: None)
    sqlite3.register_adapter(list, json.dumps)
    sqlite3.register_adapter(dict, json.dumps)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    products = [
        (1, "Own chart", "M"), (2, "Generic chart", "S"), (4, "Talla pequeño", "M"),
        (5, "Talla grande", "XS"), (6, "Feedback alert", "M"),
    ]
    with Session(engine) as session:
        for product_id, name, size in products:
            session.add(Producto(
                idProducto=product_id, idEmpresa=1, nombre=name, talla=size,
                costo=10, venta=20, idProveedor=1, idColeccion=1,
            ))
        session.add(Producto(
            idProducto=99, idEmpresa=2, nombre="Other tenant", talla="S",
            costo=10, venta=20, idProveedor=2, idColeccion=2,
        ))
        for index in range(5):
            user_id = 10 + index
            client_id = 100 + index
            sale_id = 1000 + index
            session.add(Usuario(
                idUser=user_id, nombre=f"Client {index}", correo=f"client{index}@test.local",
                contraseña="unused", codigoRol=5, idEmpresa=1,
            ))
            session.add(Cliente(
                idCliente=client_id, nombre=f"Client {index}", idUser=user_id, idEmpresa=1,
                pecho=90 if index == 0 else None, cintura=71 if index == 0 else None,
            ))
            session.add(Venta(idVenta=sale_id, idEmpresa=1, idCliente=client_id, idMetPago=1, total=20))
            for product_id in (1, 6):
                session.add(DetalleVenta(
                    codigoVenta=sale_id * 10 + product_id, idEmpresa=1, cantidad=1,
                    precio_unitario=20, idProducto=product_id, idVenta=sale_id,
                ))
        session.commit()

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


def _headers(*, client_index=0, tenant=1, permissions=None, role="Cliente"):
    user_id = tenant * 10 + client_index
    token = create_access_token(user_id, {
        "empresa": tenant, "rol": role,
        "permisos": permissions if permissions is not None else [],
    })
    return {"Authorization": f"Bearer {token}"}


def _size(talla, **measures):
    return {"talla": talla, "pecho": None, "largo": None, "hombros": None,
            "manga": None, "cintura": None, "cadera": None, **measures}


def test_own_chart_classifies_sizes_and_recommends_justa(recommendation_env):
    client = recommendation_env.client
    chart = client.put("/api/products/1/size-chart", headers=_headers(role="Administrador", permissions=["producto.editar"]), json={"tallas": [
        _size("S", pecho=87, cintura=70),
        _size("M", pecho=92, cintura=72),
        _size("L", pecho=100, cintura=82),
    ]})
    assert chart.status_code == 200
    response = client.get("/api/products/1/size-recommendation", headers=_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["fuente"] == "propia"
    assert data["talla_recomendada"] == "M"
    assert data["ajuste"] == "justa"
    assert data["tallas"] == [
        {"talla": "S", "ajuste": "ajustada"},
        {"talla": "M", "ajuste": "justa"},
        {"talla": "L", "ajuste": "holgada"},
    ]


def test_generic_chart_reuses_cu34_fallback_and_recommends(recommendation_env):
    response = recommendation_env.client.get("/api/products/2/size-recommendation", headers=_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["fuente"] == "generica"
    assert data["talla_recomendada"] == "S"
    assert data["ajuste"] == "justa"
    assert data["aviso_talla"] is None


def test_missing_profile_measures_returns_sin_medidas(recommendation_env):
    response = recommendation_env.client.get("/api/products/1/size-recommendation", headers=_headers(client_index=1))
    assert response.status_code == 200
    assert response.json() == {
        "idProducto": 1, "fuente": "generica", "sin_medidas": True,
        "medidas_cliente": {"pecho": None, "cintura": None},
        "talla_recomendada": None, "ajuste": None,
        "mensaje": "Registra tus medidas en tu perfil para recibir una recomendación de talla",
        "aviso_talla": None, "tallas": [{"talla": size, "ajuste": None} for size in ("XS", "S", "M", "L", "XL", "XXL")],
        "retroalimentacion": {"total": 0, "pequena": 0, "bien": 0, "grande": 0, "nota": None},
    }


@pytest.mark.parametrize(("product_id", "rows", "expected_warning"), [
    (4, [_size("XS", pecho=95, cintura=76), _size("S", pecho=80, cintura=60), _size("M", pecho=93, cintura=74)],
     "Esta prenda talla pequeño; te recomendamos M en lugar de S"),
    (5, [_size("XS", pecho=90, cintura=71), _size("S", pecho=95, cintura=76), _size("M", pecho=100, cintura=81)],
     "Esta prenda talla grande; te recomendamos XS en lugar de S"),
])
def test_own_chart_warns_when_recommendation_differs_from_generic_habit(product_id, rows, expected_warning, recommendation_env):
    client = recommendation_env.client
    chart = client.put(f"/api/products/{product_id}/size-chart", headers=_headers(role="Administrador", permissions=["producto.editar"]), json={"tallas": rows})
    assert chart.status_code == 200
    response = client.get(f"/api/products/{product_id}/size-recommendation", headers=_headers())
    assert response.status_code == 200
    assert response.json()["aviso_talla"] == expected_warning


def test_recommendation_returns_404_outside_tenant_or_when_missing(recommendation_env):
    client = recommendation_env.client
    assert client.get("/api/products/12345/size-recommendation", headers=_headers()).status_code == 404
    assert client.get("/api/products/99/size-recommendation", headers=_headers()).status_code == 404


def test_feedback_note_requires_at_least_three_and_sixty_percent(recommendation_env):
    client = recommendation_env.client
    for index, result in enumerate(("pequena", "pequena", "pequena", "bien", "bien")):
        response = client.post("/api/products/6/fit-feedback", headers=_headers(client_index=index), json={"resultado": result})
        assert response.status_code == 200
    response = client.get("/api/products/6/size-recommendation", headers=_headers())
    assert response.status_code == 200
    assert response.json()["retroalimentacion"] == {
        "total": 5, "pequena": 3, "bien": 2, "grande": 0,
        "nota": "El 60% de los clientes indica que esta prenda queda pequeña",
    }
