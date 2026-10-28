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
