"""CU40 visual-search contract tests; all images are generated in memory."""

import asyncio
import asyncio
import io
import json
import sqlite3
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_tenant_db
from app.main import app
from app.models import Colecciones, EmbeddingProducto, Inventario, Producto, Proveedor
from app.security import create_access_token, get_current_payload
import app.routers.products as products_router
import app.services.visual_search as visual_search


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

    async def rollback(self):
        self.session.rollback()

    def get_bind(self):
        return self.session.get_bind()


def _image_bytes(color=(200, 30, 20)):
    image = Image.new("RGB", (300, 250), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _vector(index=0, value=1.0):
    vector = [0.0] * 2048
    vector[index] = value
    return vector


@pytest.fixture
def visual_env(monkeypatch):
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
        session.add_all([
            Proveedor(idProveedor=1, idEmpresa=1, nombre="Proveedor A"),
            Colecciones(idColeccion=1, idEmpresa=1, nombre_coleccion="Colección A", idTemporada=1),
            Producto(idProducto=1, idEmpresa=1, nombre="Más parecido", costo=10, venta=20,
                     idProveedor=1, idColeccion=1, imagen_url="https://images.test/one.png"),
            Producto(idProducto=2, idEmpresa=1, nombre="Segundo parecido", costo=10, venta=25,
                     talla="M", color="Azul", idProveedor=1, idColeccion=1,
                     imagen_url="https://images.test/two.png"),
            Producto(idProducto=3, idEmpresa=1, nombre="Sin stock", costo=10, venta=30,
                     idProveedor=1, idColeccion=1, imagen_url="https://images.test/three.png"),
            Producto(idProducto=4, idEmpresa=2, nombre="Otro tenant", costo=10, venta=40,
                     idProveedor=2, idColeccion=2, imagen_url="https://images.test/four.png"),
            Producto(idProducto=5, idEmpresa=3, nombre="Índice vacío", costo=10, venta=50,
                     idProveedor=3, idColeccion=3),
            Inventario(idInv=1, idEmpresa=1, idProducto=1, codigoSucursal=1,
                       cantidad_actual=5, cantidad_reservada=1),
            Inventario(idInv=2, idEmpresa=1, idProducto=2, codigoSucursal=1,
                       cantidad_actual=3, cantidad_reservada=0),
            Inventario(idInv=3, idEmpresa=1, idProducto=3, codigoSucursal=1,
                       cantidad_actual=0, cantidad_reservada=0),
            Inventario(idInv=4, idEmpresa=2, idProducto=4, codigoSucursal=2,
                       cantidad_actual=8, cantidad_reservada=0),
            EmbeddingProducto(idProducto=1, idEmpresa=1, vector=_vector(0),
                              imagen_url="https://images.test/one.png"),
            EmbeddingProducto(idProducto=2, idEmpresa=1, vector=_vector(1),
                              imagen_url="https://images.test/two.png"),
            EmbeddingProducto(idProducto=3, idEmpresa=1, vector=_vector(0, 0.8),
                              imagen_url="https://images.test/three.png"),
            EmbeddingProducto(idProducto=4, idEmpresa=2, vector=_vector(0),
                              imagen_url="https://images.test/four.png"),
        ])
        session.commit()

    async def override_tenant_db(payload=Depends(get_current_payload)):
        with Session(engine) as session:
            session.info.update(tenant_scoped=True, tenant_id=int(payload["empresa"]))
            yield AsyncSessionAdapter(session)

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_tenant_db] = override_tenant_db
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, engine=engine)
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def _headers(*, tenant=1, permissions=None):
    token = create_access_token(tenant * 10, {
        "empresa": tenant,
        "rol": "Administrador",
        "permisos": permissions if permissions is not None else ["producto.editar", "producto.crear"],
    })
    return {"Authorization": f"Bearer {token}"}


class RollbackExpiredProduct:
    def __init__(self, product_id, image_url):
        self._product_id = product_id
        self._image_url = image_url
        self.expired = False

    @property
    def idProducto(self):
        if self.expired:
            raise RuntimeError("implicit ORM IO after rollback")
        return self._product_id

    @property
    def imagen_url(self):
        if self.expired:
            raise RuntimeError("implicit ORM IO after rollback")
        return self._image_url


class ExpiringSession:
    def __init__(self, rows):
        self.rows = rows
        self.products = []

    async def execute(self, _statement):
        return SimpleNamespace(all=lambda: self.rows)

    async def get(self, _model, product_id):
        product = RollbackExpiredProduct(product_id, f"https://images.test/{product_id}.png")
        self.products.append(product)
        return product

    async def rollback(self):
        for product in self.products:
            product.expired = True


def test_product_save_index_failure_does_not_read_expired_product_after_rollback(monkeypatch):
    product = RollbackExpiredProduct(20, "https://images.test/fail.png")
    session = ExpiringSession([])
    session.products.append(product)

    async def fail_index(*_args):
        raise OSError("image unavailable")

    monkeypatch.setattr(products_router, "index_product_image", fail_index)

    asyncio.run(products_router._index_image_after_product_save(session, product, 1))

    assert product.expired is True


def test_reindex_failure_counts_continue_without_implicit_orm_io(monkeypatch):
    rows = [
        (RollbackExpiredProduct(21, "https://images.test/21.png"), None),
        (RollbackExpiredProduct(22, "https://images.test/22.png"), None),
    ]
    session = ExpiringSession(rows)

    async def fail_index(*_args):
        raise OSError("image unavailable")

    monkeypatch.setattr(visual_search, "index_product_image", fail_index)

    counts = asyncio.run(visual_search.reindex_products(session, 1))

    assert counts == {"indexados": 0, "omitidos": 0, "errores": 2}


def test_visual_search_orders_cosine_similarity_and_filters_unavailable_and_other_tenant(
    visual_env, monkeypatch,
):
    monkeypatch.setattr(products_router, "embed_image", lambda _bytes: _vector(0))

    response = visual_env.client.post(
        "/api/products/visual-search",
        headers=_headers(),
        files={"imagen": ("consulta.png", _image_bytes(), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["indexados"] == 3
    assert [item["idProducto"] for item in body["resultados"]] == [1, 2]
    assert body["resultados"][0]["similitud"] == 1.0
    assert body["resultados"][0]["stock_total"] == 4
    assert all(item["idProducto"] != 3 for item in body["resultados"])
    assert all(item["idProducto"] != 4 for item in body["resultados"])


def test_visual_search_returns_empty_result_when_tenant_has_no_index(visual_env, monkeypatch):
    monkeypatch.setattr(products_router, "embed_image", lambda _bytes: _vector(0))

    response = visual_env.client.post(
        "/api/products/visual-search",
        headers=_headers(tenant=3),
        files={"imagen": ("consulta.png", _image_bytes(), "image/png")},
    )

    assert response.status_code == 200
    assert response.json() == {"resultados": [], "indexados": 0}


@pytest.mark.parametrize(
    "content",
    [b"not an image", b"x" * (5 * 1024 * 1024 + 1)],
    ids=["not-an-image", "over-five-megabytes"],
)
def test_visual_search_rejects_invalid_or_oversized_image_without_external_downloads(
    visual_env, content,
):
    response = visual_env.client.post(
        "/api/products/visual-search",
        headers=_headers(),
        files={"imagen": ("bad.png", content, "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "La imagen no es válida o supera 5 MB"


def test_reindex_reports_indexed_omitted_and_failed_images(visual_env, monkeypatch):
    with Session(visual_env.engine) as session:
        unchanged = session.get(Producto, 1)
        unchanged.imagen_url = "https://images.test/one.png"
        session.add(Producto(idProducto=6, idEmpresa=1, nombre="No se puede descargar",
                             costo=10, venta=20, idProveedor=1, idColeccion=1,
                             imagen_url="https://images.test/fail.png"))
        session.add(Producto(idProducto=7, idEmpresa=1, nombre="Nuevo", costo=10,
                             venta=20, idProveedor=1, idColeccion=1,
                             imagen_url="https://images.test/new.png"))
        session.commit()

    async def download(url):
        if url.endswith("fail.png"):
            raise OSError("unavailable")
        return _image_bytes()

    monkeypatch.setattr(visual_search, "download_image", download)
    monkeypatch.setattr(visual_search, "embed_image", lambda _bytes: _vector(0))

    response = visual_env.client.post(
        "/api/products/visual-search/reindex", headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"indexados": 1, "omitidos": 3, "errores": 1}
    with Session(visual_env.engine) as session:
        assert session.get(EmbeddingProducto, 7).imagen_url == "https://images.test/new.png"


def test_reindex_requires_producto_editar_permission(visual_env):
    response = visual_env.client.post(
        "/api/products/visual-search/reindex",
        headers=_headers(permissions=[]),
    )

    assert response.status_code == 403


def test_create_and_update_image_indexing_is_best_effort_and_only_runs_when_image_changes(
    visual_env, monkeypatch,
):
    calls = []

    async def fake_index(_session, product, _tenant_id):
        calls.append((product.idProducto, product.imagen_url))
        if product.imagen_url.endswith("broken.png"):
            raise OSError("could not decode image")

    monkeypatch.setattr(products_router, "index_product_image", fake_index)
    created = visual_env.client.post(
        "/api/products",
        headers=_headers(),
        json={"nombre": "Nueva", "idProveedor": 1, "idColeccion": 1,
              "imagen_url": "https://images.test/new-product.png"},
    )
    assert created.status_code == 201
    product_id = created.json()["idProducto"]

    renamed = visual_env.client.put(
        f"/api/products/{product_id}", headers=_headers(), json={"nombre": "Renombrada"},
    )
    assert renamed.status_code == 200
    failed_image = visual_env.client.put(
        f"/api/products/{product_id}", headers=_headers(),
        json={"imagen_url": "https://images.test/broken.png"},
    )
    assert failed_image.status_code == 200
    assert failed_image.json()["imagen_url"] == "https://images.test/broken.png"
    assert calls == [(product_id, "https://images.test/new-product.png"),
                     (product_id, "https://images.test/broken.png")]


def test_local_onnx_model_returns_normalized_2048_dimensional_embedding():
    embedding = visual_search.embed_image(_image_bytes())

    assert len(embedding) == 2048
    assert np.linalg.norm(embedding) == pytest.approx(1.0, abs=1e-5)
