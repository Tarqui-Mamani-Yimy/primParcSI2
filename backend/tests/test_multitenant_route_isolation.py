"""Application-level tenant isolation across business GET handlers."""

import asyncio
import inspect
import json
import sqlite3
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import create_engine, inspect as sa_inspect
from sqlalchemy.orm import Session

from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.sqltypes import Date, DateTime, Time, Boolean, Integer, Numeric

from app.database import Base
from app.main import app
import app.database as database


@compiles(ARRAY, "sqlite")
def _compile_array_for_test(_type, _compiler, **_kw):
    return "JSON"


@compiles(INET, "sqlite")
def _compile_inet_for_test(_type, _compiler, **_kw):
    return "VARCHAR(64)"


class AsyncSessionAdapter:
    """Adapt a real sync Session so async route handlers run ORM events on SQLite."""

    def __init__(self, session):
        self.session = session

    async def execute(self, statement, *args, **kwargs):
        return self.session.execute(statement, *args, **kwargs)

    async def get(self, *args, **kwargs):
        return self.session.get(*args, **kwargs)


def _seed_value(column, tenant, table_name):
    name = column.name.lower()
    table_is_tenant_scoped = "idEmpresa" in column.table.c
    value = f"tenant-{tenant}-{table_name}-{column.name}" if table_is_tenant_scoped else f"Shared-{table_name}-{column.name}"
    # New CU31 tables carry CHECK constraints in the ORM metadata; the generic
    # tenant fixture must seed valid domain values rather than synthetic labels.
    if table_name == "devolucion" and name == "tipo":
        return "devolucion"
    if table_name == "devolucion" and name == "estado":
        return "completed"
    if table_name == "movimiento_caja" and name == "kind":
        return "egreso"
    if isinstance(column.type, DateTime):
        return datetime(2026, 1, tenant, 12, 0)
    if isinstance(column.type, Date):
        return date(2026, 1, tenant)
    if isinstance(column.type, Time):
        return time(12, tenant)
    if isinstance(column.type, Boolean):
        return True
    if isinstance(column.type, Numeric):
        return Decimal(tenant * 10)
    if column.name == "nombreRol":
        return "Administrador"
    if isinstance(column.type, Integer):
        if column.foreign_keys:
            target = next(iter(column.foreign_keys)).column.table
            if target.name == "Empresa":
                return tenant
            return 1000 * tenant + 1 if "idEmpresa" in target.c else 1001
        return 1000 + tenant
    if name in {"estado", "estadostribe", "estado_stripe"}:
        return "Activo"
    if name == "ip":
        return f"192.0.2.{tenant}"
    return value


def _test_database(monkeypatch):
    # SQLite is only the app-level ORM test engine. Transaction-local Postgres
    # set_config/RLS is deliberately out of scope; SQLAlchemy's real ORM hook runs.
    monkeypatch.setattr(database, "_set_local_tenant_context", lambda *_args: None)
    sqlite3.register_adapter(list, json.dumps)
    sqlite3.register_adapter(dict, json.dumps)
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            is_tenant_table = "idEmpresa" in table.c
            is_shared_dependency = any(
                fk.column.table is table
                and "idEmpresa" in fk.parent.table.c
                for other in Base.metadata.tables.values()
                for fk in other.foreign_keys
            )
            if not is_tenant_table and not is_shared_dependency:
                continue
            for tenant in ((1, 2) if is_tenant_table else (1,)):
                values = {"idEmpresa": tenant} if is_tenant_table else {}
                for column in table.columns:
                    if column.name == "idEmpresa" or (column.nullable and column.name != "referencia") or column.default is not None or column.server_default is not None:
                        continue
                    if column.name == "referencia":
                        values[column.name] = f"dispatch-{tenant}"
                        continue
                    if column.primary_key:
                        values[column.name] = 1000 * tenant + 1
                    else:
                        values[column.name] = _seed_value(column, tenant, table.name)
                # Distinct primary keys and stable tenant IDs let the handler
                # execute normally while all fixture data remains in memory.
                for column in table.primary_key.columns:
                    if column.name not in values:
                        values[column.name] = 1000 * tenant + 1
                connection.execute(table.insert().values(**values))
    return engine


def _fixture_primary_key(engine, parameter_name, tenant):
    from sqlalchemy import select

    for mapper in Base.registry.mappers:
        table = mapper.local_table
        if parameter_name not in table.primary_key.columns:
            continue
        if "idEmpresa" not in table.c:
            continue
        key = table.primary_key.columns[0]
        with Session(engine) as fixture_session:
            return fixture_session.execute(select(key).where(table.c.idEmpresa == tenant)).scalar_one()
    raise AssertionError(f"No business fixture primary key for {parameter_name}")


def _handler_args(route, session, tenant, engine, detail_tenant=2):
    args = {}
    for name, parameter in inspect.signature(route.endpoint).parameters.items():
        if name == "session":
            args[name] = session
        elif name == "tenant_id":
            args[name] = tenant
        elif name == "payload":
            args[name] = {"sub": str(1000 * tenant + 1), "idCliente": 1000 * tenant + 1, "empresa": tenant, "rol": "Administrador", "permisos": ["venta.ver", "cliente.ver"]}
        elif name == "_":
            args[name] = None
        elif name in {"idProducto", "idProveedor", "idColeccion", "idTemporada", "codigoSucursal", "idCliente", "idRecomendacion", "idVenta"} and "{" + name + "}" in route.path:
            args[name] = _fixture_primary_key(engine, name, detail_tenant)
        elif parameter.default is not inspect.Parameter.empty:
            # FastAPI's Query objects carry a runtime default on `.default`.
            args[name] = getattr(parameter.default, "default", parameter.default)
        else:
            args[name] = 1
    return args


BUSINESS_GET_PATHS = {
    "/api/products", "/api/products/{idProducto}",
    "/api/suppliers", "/api/suppliers/{idProveedor}",
    "/api/seasons", "/api/seasons/{idTemporada}",
    "/api/collections", "/api/collections/{idColeccion}",
    "/api/branches", "/api/branches/{codigoSucursal}",
    "/api/inventory/locations", "/api/inventory/stock",
    "/api/customers/me", "/api/customers", "/api/customers/{idCliente}",
    "/api/sales", "/api/sales/{idVenta}", "/api/reservations", "/api/dispatches",
    "/api/purchase-history", "/api/recommendations", "/api/recommendations/{idRecomendacion}",
    "/api/payment-methods", "/api/logs", "/api/team", "/api/team/audit-log",
    "/api/dashboard/kpis", "/api/dashboard/ventas-diarias", "/api/dashboard/top-productos", "/api/dashboard/stock-por-sucursal",
    "/api/reports/sales", "/api/reports/sales/csv", "/api/reports/sales/pdf",
    "/api/reports/inventory", "/api/reports/inventory/csv", "/api/reports/inventory/pdf",
}


def _business_routes():
    routes = {route.path: route for route in app.routes if getattr(route, "methods", None) and "GET" in route.methods}
    return [(path, routes[path]) for path in sorted(BUSINESS_GET_PATHS)]


def _render_result(value):
    if hasattr(value, "body_iterator"):
        async def consume():
            chunks = [chunk async for chunk in value.body_iterator]
            return b"".join(chunk.encode() if isinstance(chunk, str) else chunk for chunk in chunks)

        return asyncio.run(consume()).decode("latin-1")
    def serialize(item):
        state = sa_inspect(item, raiseerr=False)
        if state is not None and hasattr(state, "mapper"):
            return {column.key: getattr(item, column.key) for column in state.mapper.column_attrs}
        return str(item)

    return json.dumps(value, default=serialize, ensure_ascii=False)


def test_business_get_handlers_scope_list_and_detail_queries(monkeypatch):
    engine = _test_database(monkeypatch)
    unsupported = []

    for path, route in _business_routes():
        # Each handler is invoked directly, while Session's registered
        # do_orm_execute listener applies the production with_loader_criteria.
        with Session(engine) as session_a:
            session_a.info.update(tenant_scoped=True, tenant_id=1)
            try:
                result_a = asyncio.run(route.endpoint(**_handler_args(route, AsyncSessionAdapter(session_a), 1, engine)))
            except Exception as exc:  # catalog unsupported fixture-specific handler requirements honestly
                if "{" in path and getattr(exc, "status_code", None) == 404:
                    pass  # Expected: A cannot resolve B's known fixture ID.
                else:
                    unsupported.append((path, type(exc).__name__, str(exc)))
                    continue
            else:
                rendered = _render_result(result_a)
                assert "tenant-2-" not in rendered, f"{path} exposed company B data: {rendered}"

        if "{" not in path:
            with Session(engine) as session_b:
                session_b.info.update(tenant_scoped=True, tenant_id=2)
                result_b = asyncio.run(route.endpoint(**_handler_args(route, AsyncSessionAdapter(session_b), 2, engine)))
            rendered_b = _render_result(result_b)
            assert "tenant-1-" not in rendered_b, f"{path} exposed company A data to B: {rendered_b}"
            rendered_a = _render_result(result_a)
            if "tenant-1-" in rendered_a:
                assert "tenant-2-" in rendered_b, f"{path} did not return B's own fixture data: {rendered_b}"
            elif path not in {"/api/reports/sales/csv", "/api/reports/sales/pdf", "/api/reports/inventory/csv", "/api/reports/inventory/pdf"}:
                assert rendered_a != rendered_b, f"{path} produced tenant-independent output despite two-tenant fixtures: {rendered_a}"

        if "{" in path:
            # Detail calls deliberately request company B's fixture primary key
            # while the session is bound to A; the route must preserve its 404.
            with Session(engine) as session_a:
                session_a.info.update(tenant_scoped=True, tenant_id=1)
                try:
                    result = asyncio.run(route.endpoint(**_handler_args(route, AsyncSessionAdapter(session_a), 1, engine)))
                except Exception as exc:
                    assert getattr(exc, "status_code", None) == 404, f"{path} returned {type(exc).__name__}, not a tenant-safe 404"
                else:
                    rendered = _render_result(result)
                    assert "tenant-2-" not in rendered, f"{path} returned company B detail: {rendered}"
            with Session(engine) as session_b:
                session_b.info.update(tenant_scoped=True, tenant_id=2)
                own = asyncio.run(route.endpoint(**_handler_args(route, AsyncSessionAdapter(session_b), 2, engine)))
                rendered = _render_result(own)
                assert "tenant-2-" in rendered, f"{path} did not return B's own fixture detail: {rendered}"
    assert not unsupported, f"handlers not executable with test fixtures: {unsupported}"
