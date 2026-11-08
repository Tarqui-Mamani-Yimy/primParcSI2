"""CU34 product size-chart API contract tests."""

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
from app.models import Producto
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
def size_chart_env(monkeypatch):
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
        from tests.plan_fixtures import seed_advanced_plan

        seed_advanced_plan(session, tenant_ids=(1, 2))
        session.add_all([
            Producto(
                idProducto=1, idEmpresa=1, nombre="Camisa propia", costo=10, venta=20,
                idProveedor=1, idColeccion=1,
            ),
            Producto(
                idProducto=2, idEmpresa=1, nombre="Camisa generica", costo=10, venta=20,
                idProveedor=1, idColeccion=1,
            ),
            Producto(
                idProducto=3, idEmpresa=2, nombre="Otro tenant", costo=10, venta=20,
                idProveedor=2, idColeccion=2,
            ),
        ])
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


def _headers(*, tenant=1, permissions=None):
    token = create_access_token(tenant * 10, {
        "empresa": tenant,
        "rol": "Administrador",
        "permisos": permissions if permissions is not None else ["producto.editar"],
    })
    return {"Authorization": f"Bearer {token}"}


def _size(talla, **measures):
    return {"talla": talla, "pecho": None, "largo": None, "hombros": None,
            "manga": None, "cintura": None, "cadera": None, **measures}


def test_get_own_size_chart_returns_exact_contract_and_sorted_sizes(size_chart_env):
    client = size_chart_env.client
    saved = client.put("/api/products/1/size-chart", headers=_headers(), json={"tallas": [
        _size("m", pecho=98), _size("XS", pecho=80), _size("32", cintura=81),
    ]})
    assert saved.status_code == 200
    response = client.get("/api/products/1/size-chart", headers=_headers())
    assert response.status_code == 200
    assert response.json() == {
        "idProducto": 1,
        "fuente": "propia",
        "tallas": [
            _size("XS", pecho=80), _size("M", pecho=98), _size("32", cintura=81),
        ],
    }


def test_get_generic_size_chart_uses_generic_table_midpoints(size_chart_env):
    response = size_chart_env.client.get("/api/products/2/size-chart", headers=_headers())
    assert response.status_code == 200
    assert response.json() == {
        "idProducto": 2,
        "fuente": "generica",
        "tallas": [
            _size("XS", pecho=81.5, cintura=63.5),
            _size("S", pecho=89.5, cintura=71.5),
            _size("M", pecho=97.5, cintura=79.5),
            _size("L", pecho=105.5, cintura=87.5),
            _size("XL", pecho=113.5, cintura=95.5),
            _size("XXL", pecho=121.5, cintura=103.5),
        ],
    }


def test_get_size_chart_returns_404_for_missing_or_other_tenant_product(size_chart_env):
    client = size_chart_env.client
    assert client.get("/api/products/99/size-chart", headers=_headers()).status_code == 404
    assert client.get("/api/products/3/size-chart", headers=_headers()).status_code == 404


def test_put_replaces_whole_size_chart(size_chart_env):
    client = size_chart_env.client
    first = client.put("/api/products/1/size-chart", headers=_headers(), json={"tallas": [
        _size("S", pecho=90), _size("M", pecho=100),
    ]})
    assert first.status_code == 200
    replaced = client.put("/api/products/1/size-chart", headers=_headers(), json={"tallas": [
        _size("L", pecho=110),
    ]})
    assert replaced.status_code == 200
    assert replaced.json() == {"idProducto": 1, "fuente": "propia", "tallas": [_size("L", pecho=110)]}


def test_put_empty_chart_deletes_own_rows_and_returns_generic_fallback(size_chart_env):
    client = size_chart_env.client
    assert client.put("/api/products/1/size-chart", headers=_headers(), json={
        "tallas": [_size("S", pecho=90)],
    }).status_code == 200
    response = client.put("/api/products/1/size-chart", headers=_headers(), json={"tallas": []})
    assert response.status_code == 200
    assert response.json()["fuente"] == "generica"
    assert [row["talla"] for row in response.json()["tallas"]] == ["XS", "S", "M", "L", "XL", "XXL"]


@pytest.mark.parametrize("rows", [
    [_size("  ", pecho=90)],
    [_size("S", pecho=90), _size(" s ", cintura=70)],
    [_size("S")],
    [_size("S", pecho=0)],
    [_size("S", cintura=300.1)],
])
def test_put_rejects_invalid_size_chart_rows(size_chart_env, rows):
    response = size_chart_env.client.put("/api/products/1/size-chart", headers=_headers(), json={"tallas": rows})
    assert response.status_code in (400, 422)
    assert isinstance(response.json()["detail"], (str, dict, list))


def test_put_requires_producto_editar_permission(size_chart_env):
    response = size_chart_env.client.put("/api/products/1/size-chart", headers=_headers(permissions=[]), json={
        "tallas": [_size("S", pecho=90)],
    })
    assert response.status_code == 403
