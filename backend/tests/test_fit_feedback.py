"""CU36 fit feedback API contract tests."""

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
def feedback_env(monkeypatch):
    import app.database as database

    monkeypatch.setattr(database, "_set_local_tenant_context", lambda *_args: None)
    sqlite3.register_adapter(list, json.dumps)
    sqlite3.register_adapter(dict, json.dumps)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for product_id, tenant, size in ((1, 1, "M"), (2, 1, "S"), (99, 2, "L")):
            session.add(Producto(
                idProducto=product_id, idEmpresa=tenant, nombre=f"Product {product_id}",
                talla=size, imagen_url=f"https://example.test/{product_id}.png",
                costo=10, venta=20, idProveedor=tenant, idColeccion=tenant,
            ))
        for index in range(5):
            user_id, client_id, sale_id = 10 + index, 100 + index, 1000 + index
            session.add(Usuario(
                idUser=user_id, nombre=f"Client {index}", correo=f"client{index}@test.local",
                contraseña="unused", codigoRol=5, idEmpresa=1,
            ))
            session.add(Cliente(idCliente=client_id, nombre=f"Client {index}", idUser=user_id, idEmpresa=1))
            session.add(Venta(idVenta=sale_id, idEmpresa=1, idCliente=client_id, idMetPago=1, total=20))
            session.add(DetalleVenta(
                codigoVenta=sale_id, idEmpresa=1, cantidad=1, precio_unitario=20,
                idProducto=1, idVenta=sale_id,
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


def test_feedback_post_creates_and_upserts_one_answer_per_product(feedback_env):
    client = feedback_env.client
    first = client.post("/api/products/1/fit-feedback", headers=_headers(), json={
        "resultado": "pequena", "comentario": "La manga quedó corta",
    })
    assert first.status_code == 200
    changed = client.post("/api/products/1/fit-feedback", headers=_headers(), json={"resultado": "bien"})
    assert changed.status_code == 200
    mine = client.get("/api/fit-feedback/mine", headers=_headers())
    assert mine.status_code == 200
    answers = [item for item in mine.json() if item["idProducto"] == 1]
    assert len(answers) == 1
    assert answers[0]["resultado"] == "bien"
    assert answers[0]["talla"] == "M"
    assert answers[0]["fecha"] is not None


def test_feedback_post_requires_completed_purchase_and_product(feedback_env):
    client = feedback_env.client
    assert client.post("/api/products/2/fit-feedback", headers=_headers(), json={"resultado": "bien"}).status_code == 403
    assert client.post("/api/products/12345/fit-feedback", headers=_headers(), json={"resultado": "bien"}).status_code == 404


def test_feedback_mine_lists_each_bought_product_with_saved_or_empty_feedback(feedback_env):
    client = feedback_env.client
    response = client.get("/api/fit-feedback/mine", headers=_headers())
    assert response.status_code == 200
    assert response.json() == [{
        "idProducto": 1, "nombre": "Product 1", "talla": "M",
        "imagen_url": "https://example.test/1.png", "resultado": None, "fecha": None,
    }]


def test_summary_shows_alert_above_unflagged_and_requires_producto_editar(feedback_env):
    client = feedback_env.client
    for index, result in enumerate(("pequena", "pequena", "pequena", "bien", "bien")):
        assert client.post("/api/products/1/fit-feedback", headers=_headers(client_index=index), json={"resultado": result}).status_code == 200
    denied = client.get("/api/fit-feedback/summary", headers=_headers())
    assert denied.status_code == 403
    allowed = client.get("/api/fit-feedback/summary", headers=_headers(role="Administrador", permissions=["producto.editar"]))
    assert allowed.status_code == 200
    data = allowed.json()
    alert = next(item for item in data if item["idProducto"] == 1)
    assert alert == {
        "idProducto": 1, "nombre": "Product 1", "talla": "M",
        "total": 5, "pequena": 3, "bien": 2, "grande": 0, "alerta": True,
    }
    assert data[0] == alert


def test_feedback_endpoints_reject_non_client_users(feedback_env):
    headers = _headers(role="Administrador", permissions=["producto.editar"])
    assert feedback_env.client.get("/api/fit-feedback/mine", headers=headers).status_code == 403
    assert feedback_env.client.post("/api/products/1/fit-feedback", headers=headers, json={"resultado": "bien"}).status_code == 403
