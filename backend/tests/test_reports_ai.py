"""CU32 generated report API contracts using a mocked Gemini client."""

from types import SimpleNamespace

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import get_tenant_db
from app.security import create_access_token, get_current_payload
from tests.test_multitenant_route_isolation import AsyncSessionAdapter, _test_database


class FakeModels:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return next(self.responses)


def _tool_call(name="sales_by_period", args=None):
    content = SimpleNamespace(role="model", parts=[])
    return SimpleNamespace(
        function_calls=[SimpleNamespace(name=name, args=args or {})],
        candidates=[SimpleNamespace(content=content)],
        text=None,
    )


def _final_text(text="Report generated from verified business data."):
    return SimpleNamespace(function_calls=[], candidates=[], text=text)


def _fake_client(*responses):
    models = FakeModels(responses)
    return SimpleNamespace(aio=SimpleNamespace(models=models)), models


@pytest.fixture
def report_api(monkeypatch):
    from app.main import app
    from app.routers import reports_ai
    from app.services import reportes_ia_gemini
    import tests.test_multitenant_route_isolation as tenant_tests

    original_create_engine = tenant_tests.create_engine
    monkeypatch.setattr(
        tenant_tests,
        "create_engine",
        lambda url: original_create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        ),
    )
    engine = _test_database(monkeypatch)
    previous_overrides = app.dependency_overrides.copy()

    async def tenant_session(payload=Depends(get_current_payload)):
        with Session(engine) as session:
            session.info.update(tenant_scoped=True, tenant_id=int(payload["empresa"]))
            yield AsyncSessionAdapter(session)

    feature_dependency = reports_ai.router.dependencies[0].dependency
    app.dependency_overrides[get_tenant_db] = tenant_session
    app.dependency_overrides[feature_dependency] = lambda: None
    csv_route = next(route for route in app.routes if getattr(route, "path", None) == "/api/reports/ai/csv")
    for dependency in csv_route.dependencies:
        app.dependency_overrides[dependency.dependency] = lambda: None
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, engine=engine, service=reports_ai, gemini=reportes_ia_gemini)
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def _headers(tenant_id=1, permissions=None, role="Administrador"):
    token = create_access_token(
        tenant_id * 10,
        {
            "empresa": tenant_id,
            "rol": role,
            "permisos": permissions if permissions is not None else ["reporte.ver"],
        },
    )
    return {"Authorization": f"Bearer {token}"}


def _mock_sales_report(monkeypatch, service, start_date=None, end_date=None):
    client, models = _fake_client(
        _tool_call("sales_by_period", {"start_date": start_date, "end_date": end_date}),
        _final_text(),
    )
    monkeypatch.setattr(service, "_client", lambda: client)
    monkeypatch.setattr(service, "gemini_configurado", lambda: True)
    return models


def test_ai_report_returns_tenant_scoped_data_and_expected_shape(report_api, monkeypatch):
    service = report_api.gemini
    models = _mock_sales_report(monkeypatch, service)

    response = report_api.client.post(
        "/api/reports/ai",
        json={"prompt": "Show sales by branch"},
        headers=_headers(tenant_id=1),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"summary", "columns", "rows", "tool_used", "period"}
    assert body["summary"] == "Report generated from verified business data."
    assert body["tool_used"] == "sales_by_period"
    assert body["period"] == {"from": None, "to": None}
    assert body["columns"] == ["Producto", "Sucursal", "Cantidad vendida", "Monto"]
    assert body["rows"]
    assert all(str(row[0]).startswith("tenant-1-") for row in body["rows"])
    assert all("tenant-2-" not in str(row) for row in body["rows"])
    declared = models.calls[0]["config"].tools[0].function_declarations
    assert all("tenant_id" not in declaration.parameters_json_schema.get("properties", {}) for declaration in declared)


def test_ai_report_rejects_unknown_tool_calls(report_api, monkeypatch):
    client, _ = _fake_client(_tool_call("run_sql", {"query": "SELECT * FROM Venta"}))
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "Show sales"}, headers=_headers()
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "gemini_invalid_tool"


def test_ai_report_uses_default_top_products_limit_when_model_sends_null(report_api, monkeypatch):
    client, _ = _fake_client(
        _tool_call("top_products", {"limit": None}),
        _final_text(),
    )
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "Show top products"}, headers=_headers()
    )

    assert response.status_code == 200, response.text
    assert response.json()["tool_used"] == "top_products"


def test_ai_report_returns_clear_503_when_gemini_is_unconfigured(report_api, monkeypatch):
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: False)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "Show low stock"}, headers=_headers()
    )

    assert response.status_code == 503
    assert "Gemini" in response.json()["detail"]


def test_ai_report_requires_existing_admin_report_permission(report_api):
    response = report_api.client.post(
        "/api/reports/ai",
        json={"prompt": "Show sales"},
        headers=_headers(permissions=[]),
    )

    assert response.status_code == 403


def test_ai_report_and_csv_require_admin_even_if_another_role_has_report_permission(report_api):
    headers = _headers(role="Cajero", permissions=["reporte.ver"])
    payload = {"prompt": "Show sales"}

    json_response = report_api.client.post("/api/reports/ai", json=payload, headers=headers)
    csv_response = report_api.client.post("/api/reports/ai/csv", json=payload, headers=headers)

    assert json_response.status_code == 403
    assert csv_response.status_code == 403


def test_ai_report_can_export_the_same_table_as_csv(report_api, monkeypatch):
    service = report_api.gemini
    _mock_sales_report(monkeypatch, service)

    response = report_api.client.post(
        "/api/reports/ai/csv",
        json={"prompt": "Show sales by branch"},
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "Producto,Sucursal,Cantidad vendida,Monto" in response.text
    assert "tenant-1-" in response.text
    assert "tenant-2-" not in response.text



def test_ai_report_maps_gemini_api_errors_to_502_instead_of_500(report_api, monkeypatch):
    from google.genai import errors

    class FailingModels:
        async def generate_content(self, **kwargs):
            raise errors.ClientError(404, {"error": {"code": 404, "message": "model retired", "status": "NOT_FOUND"}})

    client = SimpleNamespace(aio=SimpleNamespace(models=FailingModels()))
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "Show sales"}, headers=_headers()
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "gemini_report_failed"


def test_ai_report_uses_the_configured_gemini_model(report_api, monkeypatch):
    from app.config import get_settings

    service = report_api.gemini
    models = _mock_sales_report(monkeypatch, service)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "Show sales"}, headers=_headers()
    )

    assert response.status_code == 200
    # The code default is checked on the field itself because .env may override it.
    assert type(get_settings()).model_fields["GEMINI_MODEL"].default == "gemini-3.8-flash"
    assert models.calls[0]["model"] == get_settings().GEMINI_MODEL


def test_ai_report_tells_gemini_todays_date_to_resolve_relative_periods(report_api, monkeypatch):
    from datetime import date

    models = _mock_sales_report(monkeypatch, report_api.gemini)

    response = report_api.client.post(
        "/api/reports/ai", json={"prompt": "ventas del último mes"}, headers=_headers()
    )

    assert response.status_code == 200
    assert date.today().isoformat() in models.calls[0]["config"].system_instruction


def _seed_branch_sales(engine, tenant=1, reservation=False):
    from datetime import date, datetime, time
    from sqlalchemy import select
    from app.models import Cliente, Colecciones, Inventario, Producto, Proveedor, Sucursal, MetodoPago, Venta

    with Session(engine) as session:
        client_id = session.execute(select(Cliente.idCliente).where(Cliente.idEmpresa == tenant)).scalar_one()
        branch = session.execute(select(Sucursal).where(Sucursal.idEmpresa == tenant)).scalar_one()
        product = session.execute(select(Producto).where(Producto.idEmpresa == tenant)).scalar_one()
        provider_id = session.execute(select(Proveedor.idProveedor).where(Proveedor.idEmpresa == tenant)).scalar_one()
        collection_id = session.execute(select(Colecciones.idColeccion).where(Colecciones.idEmpresa == tenant)).scalar_one()
        payment_id = session.execute(select(MetodoPago.idMetPago).where(MetodoPago.idEmpresa == tenant)).scalar_one()
        branch2_id = tenant * 10000 + 2
        product2_id = tenant * 10000 + 2
        inventory1_id = tenant * 10000 + 1
        inventory2_id = tenant * 10000 + 2
        sale_id = tenant * 10000 + 1
        session.execute(Sucursal.__table__.insert().values(
            codigoSucursal=branch2_id, idEmpresa=tenant, nombre=f"Sucursal {tenant} B",
            direccion="Calle test", idCiudad=branch.idCiudad,
        ))
        session.execute(Producto.__table__.insert().values(
            idProducto=product2_id, idEmpresa=tenant, nombre=f"Producto {tenant} B",
            costo=1, venta=50, idProveedor=provider_id, idColeccion=collection_id,
        ))
        inventory1_id = session.execute(select(Inventario.idInv).where(
            Inventario.codigoSucursal == branch.codigoSucursal, Inventario.idProducto == product.idProducto
        )).scalar_one()
        session.execute(Inventario.__table__.insert().values(
            idInv=inventory2_id, idEmpresa=tenant, cantidad_actual=10,
            cantidad_reservada=0, codigoSucursal=branch2_id, idProducto=product.idProducto,
        ))
        session.execute(Inventario.__table__.insert().values(
            idInv=inventory2_id + 1, idEmpresa=tenant, cantidad_actual=10,
            cantidad_reservada=0, codigoSucursal=branch.codigoSucursal, idProducto=product2_id,
        ))
        if not reservation:
            session.execute(Inventario.__table__.insert().values(
                idInv=inventory2_id + 2, idEmpresa=tenant, cantidad_actual=10,
                cantidad_reservada=0, codigoSucursal=branch2_id, idProducto=product2_id,
            ))
        session.execute(Venta.__table__.insert().values(
            idVenta=sale_id, idEmpresa=tenant, fecha=datetime(2026, 11, 1), total=200,
            descuento_promociones=0, descuento_cupon=0, descuento_puntos=0, puntos_canjeados=0,
            puntos_ganados=0, idCliente=client_id, idMetPago=payment_id,
        ))
        reservation_id = tenant * 10000 + 1
        if reservation:
            from app.models import Reserva
            session.execute(Reserva.__table__.insert().values(
                codigoReserva=reservation_id, idEmpresa=tenant, fecha=date(2026, 11, 1), horario=time(12),
                estado="Confirmada", idCliente=client_id, codigoSucursal=branch2_id,
                idProducto=product2_id, idMetPago=payment_id,
            ))
        from app.models import DetalleVenta, Movimiento
        session.execute(DetalleVenta.__table__.insert().values(
            codigoVenta=sale_id, idEmpresa=tenant, cantidad=2, precio_unitario=100,
            idProducto=product2_id if reservation else product.idProducto, idVenta=sale_id,
            codigoReserva=reservation_id if reservation else None,
        ))
        session.execute(Movimiento.__table__.insert().values(
            idMov=sale_id, idEmpresa=tenant, tipo="venta", cantidad=-2,
            fecha=datetime(2026, 11, 1), motivo=f"Venta {sale_id}", idInv=inventory1_id,
        ))
        if not reservation:
            session.execute(Venta.__table__.insert().values(
                idVenta=sale_id + 1, idEmpresa=tenant, fecha=datetime(2026, 11, 2), total=50,
                descuento_promociones=0, descuento_cupon=0, descuento_puntos=0, puntos_canjeados=0,
                puntos_ganados=0, idCliente=client_id, idMetPago=payment_id,
            ))
            session.execute(DetalleVenta.__table__.insert().values(
                codigoVenta=sale_id + 1, idEmpresa=tenant, cantidad=1, precio_unitario=50,
                idProducto=product2_id, idVenta=sale_id + 1,
            ))
            session.execute(Movimiento.__table__.insert().values(
                idMov=sale_id + 1, idEmpresa=tenant, tipo="venta", cantidad=-1,
                fecha=datetime(2026, 11, 2), motivo=f"Offline sale {sale_id + 1}", idInv=inventory2_id + 2,
            ))
        session.commit()
        return branch.codigoSucursal, branch2_id, product.nombre, product2_id


def test_top_products_by_branch_ranks_per_branch_and_uses_actual_sale_branch(report_api, monkeypatch):
    branch1, branch2, product_name, _ = _seed_branch_sales(report_api.engine)
    client, _ = _fake_client(_tool_call(
        "top_products_by_branch", {"start_date": "2026-10-01", "end_date": "2026-11-30", "limit": 1}
    ), _final_text())
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)

    response = report_api.client.post("/api/reports/ai", json={"prompt": "top por sucursal"}, headers=_headers())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["columns"] == ["Sucursal", "Ranking", "Producto", "Cantidad vendida", "Monto"]
    assert len(body["rows"]) == 2
    assert [row[0] for row in body["rows"]] == ["Sucursal 1 B", "tenant-1-Sucursal-nombre"]
    assert body["rows"][0][1:] == [1, "Producto 1 B", 1, 50.0]
    assert body["rows"][1][1:] == [1, product_name, 2, 200.0]
    assert body["tool_used"] == "top_products_by_branch"
    assert branch1 != branch2


def test_top_products_by_branch_reservation_uses_reservation_branch(report_api, monkeypatch):
    _branch1, branch2, _product, product2_id = _seed_branch_sales(report_api.engine, reservation=True)
    from app.models import Producto
    with Session(report_api.engine) as session:
        product2_name = session.get(Producto, product2_id).nombre
    client, _ = _fake_client(_tool_call("top_products_by_branch", {}), _final_text())
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)
    response = report_api.client.post("/api/reports/ai", json={"prompt": "ventas por sucursal"}, headers=_headers())
    assert response.status_code == 200, response.text
    assert any(row[2] == product2_name and row[0] == "Sucursal 1 B" for row in response.json()["rows"]), response.json()["rows"]


def test_top_products_by_branch_is_tenant_scoped(report_api, monkeypatch):
    _seed_branch_sales(report_api.engine, tenant=1)
    _seed_branch_sales(report_api.engine, tenant=2)
    client, _ = _fake_client(_tool_call("top_products_by_branch", {}), _final_text())
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)
    response = report_api.client.post("/api/reports/ai", json={"prompt": "top productos por sucursal"}, headers=_headers(1))
    assert response.status_code == 200, response.text
    assert all("tenant-2-" not in str(row) and "Producto 2" not in str(row) for row in response.json()["rows"])


@pytest.mark.parametrize("args", [
    {"limit": 21},
    {"start_date": "2026-11-02", "end_date": "2026-11-01"},
])
def test_top_products_by_branch_rejects_invalid_arguments(report_api, monkeypatch, args):
    client, _ = _fake_client(_tool_call("top_products_by_branch", args))
    monkeypatch.setattr(report_api.gemini, "_client", lambda: client)
    monkeypatch.setattr(report_api.gemini, "gemini_configurado", lambda: True)
    response = report_api.client.post("/api/reports/ai", json={"prompt": "top por sucursal"}, headers=_headers())
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "gemini_invalid_tool"


def test_existing_tool_contracts_remain_unchanged():
    from app.services.reportes_ia_gemini import _arguments
    assert _arguments("top_products", {"limit": None})["limit"] == 5
    assert set(_arguments("sales_by_period", {"branch_id": 1})) == {"branch_id"}
