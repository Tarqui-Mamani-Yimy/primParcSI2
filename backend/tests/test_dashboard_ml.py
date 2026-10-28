import json
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DetalleVenta, Venta
from app.schemas.dashboard_ml import (
    CustomerSegmentCustomer,
    CustomerSegmentSummary,
    DailySalesPoint,
    ProductTrendItem,
    SalesForecastModel,
    SalesForecastPoint,
    StockoutRiskItem,
)
from tests.test_reports_ai import _headers, report_api


ENDPOINT_CONTRACTS = [
    ("/api/dashboard/ml/sales-forecast?days=7&branch_id=1001", {"insufficient_data", "history", "forecast", "total_forecast_amount", "model"}, "forecast"),
    ("/api/dashboard/ml/stockout-risk", {"insufficient_data", "items"}, "items"),
    ("/api/dashboard/ml/product-trends", {"insufficient_data", "items"}, "items"),
    ("/api/dashboard/ml/customer-segments", {"insufficient_data", "segments", "customers"}, "segments"),
]


@pytest.mark.parametrize(("path", "expected_keys", "list_key"), ENDPOINT_CONTRACTS)
def test_ml_endpoint_contract_and_insufficient_data(report_api, path, expected_keys, list_key):
    response = report_api.client.get(path, headers=_headers())

    assert response.status_code == 200, response.text
    payload = response.json()
    assert set(payload) == expected_keys
    assert isinstance(payload["insufficient_data"], bool)
    assert payload["insufficient_data"] is True
    assert isinstance(payload[list_key], list)


def test_sales_forecast_tenant_scope_uses_only_jwt_company(report_api):
    now = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
    with Session(report_api.engine) as session:
        for tenant_id, amount in ((1, 111), (2, 222)):
            sale = session.execute(
                select(Venta).where(Venta.idEmpresa == tenant_id)
            ).scalars().one()
            sale.fecha = now - timedelta(days=1)
            detail = session.execute(
                select(DetalleVenta).where(DetalleVenta.idEmpresa == tenant_id)
            ).scalars().one()
            detail.cantidad = 1
            detail.precio_unitario = amount
        session.commit()

    response = report_api.client.get(
        "/api/dashboard/ml/sales-forecast?days=7",
        headers=_headers(tenant_id=1),
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert any(point["amount"] == 111 for point in payload["history"])
    assert "222" not in json.dumps(payload)


def test_ml_endpoints_reject_non_admin(report_api):
    response = report_api.client.get(
        "/api/dashboard/ml/customer-segments",
        headers=_headers(role="Cajero"),
    )

    assert response.status_code == 403


def test_stockout_risk_orders_zero_days_before_later_stockouts(report_api, monkeypatch):
    from app.services import ml_proyecciones

    today = datetime.now().date()
    inventory = [
        SimpleNamespace(
            idProducto=1,
            codigoSucursal=1001,
            cantidad_actual=0,
            product_name="Out of stock",
            size="M",
            branch_name="Main",
        ),
        SimpleNamespace(
            idProducto=2,
            codigoSucursal=1001,
            cantidad_actual=10,
            product_name="Low stock",
            size="L",
            branch_name="Main",
        ),
    ]
    sales = [
        SimpleNamespace(
            idProducto=product_id,
            codigoSucursal=1001,
            fecha=datetime.combine(today - timedelta(days=offset), datetime.min.time()),
            units=1,
        )
        for offset in range(14)
        for product_id in (1, 2)
    ]

    async def fake_stock_rows(session, tenant_id, branch_id):
        assert tenant_id == 1
        return inventory

    async def fake_stock_demand_rows(session, tenant_id, start, end, branch_id):
        assert tenant_id == 1
        return sales

    monkeypatch.setattr(ml_proyecciones, "_stock_rows", fake_stock_rows)
    monkeypatch.setattr(ml_proyecciones, "_stock_demand_rows", fake_stock_demand_rows)

    response = report_api.client.get("/api/dashboard/ml/stockout-risk", headers=_headers())

    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [item["days_to_stockout"] for item in items] == [0.0, 21.43]


@pytest.mark.parametrize("days", [6, 91])
def test_sales_forecast_validates_days_range(report_api, days):
    response = report_api.client.get(
        f"/api/dashboard/ml/sales-forecast?days={days}",
        headers=_headers(),
    )

    assert response.status_code == 422


def test_nested_schema_fields_match_fixed_frontend_contract():
    assert set(DailySalesPoint.model_fields) == {"date", "amount", "units"}
    assert set(SalesForecastPoint.model_fields) == {"date", "amount", "lower", "upper"}
    assert set(SalesForecastModel.model_fields) == {"name", "mae"}
    assert set(StockoutRiskItem.model_fields) == {
        "product_id", "product_name", "talla", "branch_id", "branch_name",
        "current_stock", "daily_demand", "days_to_stockout", "suggested_restock",
    }
    assert set(ProductTrendItem.model_fields) == {
        "product_id", "product_name", "trend", "slope", "units_last_30", "units_prev_30",
    }
    assert set(CustomerSegmentSummary.model_fields) == {
        "segment", "label", "customers", "avg_recency_days", "avg_frequency", "avg_amount",
    }
    assert set(CustomerSegmentCustomer.model_fields) == {
        "customer_id", "name", "segment", "recency_days", "frequency", "monetary",
    }


def test_sales_forecast_keeps_amount_inside_residual_band():
    from app.services.ml_proyecciones import proyectar_ventas

    start = datetime.now().date() - timedelta(days=55)
    history = [
        {
            "date": start + timedelta(days=index),
            "amount": float(40 + index * 1.5 + ((index + 1) % 7) * 3),
            "units": 1 + index // 10,
        }
        for index in range(56)
    ]

    forecast, model = proyectar_ventas(history, days=7)

    assert model["name"]
    assert model["mae"] >= 0
    assert len(forecast) == 7
    assert all(point["lower"] <= point["amount"] <= point["upper"] for point in forecast)


def test_weekly_product_trend_classifies_increasing_series():
    from app.services.ml_proyecciones import clasificar_tendencia_semanal

    assert clasificar_tendencia_semanal([1, 2, 3, 4, 5, 6, 7, 8]) == "creciendo"


def test_stock_demand_query_exposes_units_column():
    """Regression: `-col.label(...)` drops the label, so rows had no `units` (500 on real data)."""
    import asyncio
    from datetime import date

    from app.services import ml_proyecciones

    captured = {}

    class CapturingSession:
        async def execute(self, statement):
            captured["statement"] = statement

            class Result:
                def all(self):
                    return []

            return Result()

    asyncio.run(
        ml_proyecciones._stock_demand_rows(CapturingSession(), 1, date(2026, 1, 1), date(2026, 2, 1), None)
    )

    assert "units" in captured["statement"].selected_columns.keys()


def test_ml_seed_uses_company_apparel_names_and_renames_legacy_products():
    seed_path = Path(__file__).parents[1] / "database" / "seeds" / "seed_historial_ml.sql"
    seed_sql = seed_path.read_text(encoding="utf-8")

    expected_names = {
        "Polera Oversize Negra", "Jean Mom Celeste", "Chompa de Alpaca Beige", "Camisa de Lino Blanca",
        "Vestido Midi Floral Azul", "Pantalón Sastre Negro", "Falda Plisada Terracota", "Blusa Manga Globo Marfil",
        "Chaqueta Denim Azul Noche", "Polera Cuello Alto Verde Oliva", "Short Sastrero Arena", "Suéter Tejido Lavanda",
    }
    assert all(name in seed_sql for name in expected_names)
    assert "UPDATE producto" in seed_sql
    assert "legacy_display_name" in seed_sql
    assert "SET nombre = spec.display_name" in seed_sql
    assert "descripcion = spec.description" in seed_sql
    assert seed_sql.index("UPDATE producto") < seed_sql.index("INSERT INTO producto")
    assert "WHEN 'rising' THEN 1" in seed_sql
    assert "WHEN 'steady' THEN 2" in seed_sql
    assert "WHEN 'falling' THEN 3" in seed_sql
