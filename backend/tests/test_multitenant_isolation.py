"""Representative tenant-isolation coverage for business endpoints."""

import asyncio

from fastapi import HTTPException

from app.routers.products import get_product, list_products


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value[0] if self.value else None

    def scalars(self):
        return self

    def all(self):
        return self.value


class TenantSession:
    """Small tenant-aware fake that refuses unscoped Product selects."""

    def __init__(self, products):
        self.products = products
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        sql = str(statement.compile(compile_kwargs={"literal_binds": True}))
        assert 'idEmpresa' in sql, f"unscoped query: {sql}"
        tenant = next((p.idEmpresa for p in self.products if f'"idEmpresa" = {p.idEmpresa}' in sql), None)
        requested_id = int(sql.split('"idProducto" = ')[-1].split()[0]) if '"idProducto" = ' in sql else None
        matching = [p for p in self.products if p.idEmpresa == tenant and (requested_id is None or p.idProducto == requested_id)]
        if "count(" in sql.lower():
            return Result(len(matching))
        return Result(matching)

    async def get(self, model, product_id):
        return None


class Product:
    def __init__(self, id_product, tenant, name):
        self.idProducto = id_product
        self.idEmpresa = tenant
        self.nombre = name
        self.descripcion = ""
        self.costo = 1
        self.venta = 2
        self.tipo = self.talla = self.color = None
        self.idProveedor = self.idColeccion = 1
        self.imagen_url = None
        self.imagenes_secundarias = []


def test_product_list_and_detail_are_isolated_between_tenants():
    products = [Product(11, 1, "Tenant A product"), Product(22, 2, "Tenant B product")]

    async def exercise():
        session_a = TenantSession(products)
        listed_a = await list_products(tenant_id=1, session=session_a, page=1, size=20, query=None)
        assert listed_a.total == 1
        assert [item.nombre for item in listed_a.items] == ["Tenant A product"]

        session_b = TenantSession(products)
        listed_b = await list_products(tenant_id=2, session=session_b, page=1, size=20, query=None)
        assert listed_b.total == 1
        assert [item.nombre for item in listed_b.items] == ["Tenant B product"]

        try:
            await get_product(22, tenant_id=1, session=session_a)
        except HTTPException as exc:
            assert exc.status_code == 404
        else:
            raise AssertionError("Tenant A must not retrieve Tenant B detail")

    asyncio.run(exercise())
