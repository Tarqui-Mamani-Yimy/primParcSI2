"""Backend contract tests for mobile customer return requests."""

import pytest

pytest_plugins = ("tests.test_returns",)

from app.security import create_access_token
from tests.test_returns import _headers


def _customer_headers(tenant_id=1, user_id=None):
    token = create_access_token(user_id or tenant_id * 10, {
        "empresa": tenant_id,
        "rol": "Cliente",
        "permisos": ["devolucion.solicitar", "venta.crear"],
    })
    return {"Authorization": f"Bearer {token}"}


def _request_payload(sale_id=100, quantity=1):
    return {
        "idVenta": sale_id,
        "items": [{"sale_item_id": 1001, "quantity": quantity}],
        "motivo": "Talla incorrecta",
        "banco": "Banco de prueba",
        "numeroCuenta": "123456789",
        "titularCuenta": "Cliente 1",
    }


def test_customer_can_request_return_for_own_sale_and_list_it(return_env):
    client = return_env.client
    created = client.post("/api/returns/requests", json=_request_payload(), headers=_customer_headers())

    assert created.status_code == 201
    assert created.json()["estado"] == "solicitada"
    assert created.json()["idVenta"] == 100
    mine = client.get("/api/returns/requests/mine", headers=_customer_headers())
    assert mine.status_code == 200
    assert mine.json()[0]["motivo"] == "Talla incorrecta"
    assert mine.json()[0]["items"][0]["sale_item_id"] == 1001


def test_customer_cannot_request_return_for_another_tenants_sale(return_env):
    response = return_env.client.post(
        "/api/returns/requests", json=_request_payload(sale_id=200), headers=_customer_headers()
    )

    assert response.status_code == 404


def test_staff_can_reject_return_request_with_reason(return_env):
    client = return_env.client
    created = client.post("/api/returns/requests", json=_request_payload(), headers=_customer_headers())
    request_id = created.json()["idDevolucion"]

    rejected = client.post(
        f"/api/returns/requests/{request_id}/reject",
        json={"motivoRechazo": "Prenda usada"},
        headers=_headers(permissions=["devolucion.gestionar"]),
    )

    assert rejected.status_code == 200
    assert rejected.json()["estado"] == "rechazada"
    assert rejected.json()["motivoRechazo"] == "Prenda usada"


def test_staff_approves_then_records_manual_bank_transfer_refund(return_env, monkeypatch):
    from app.routers import returns

    called = False

    async def no_stripe(*_args, **_kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(returns, "crear_refund", no_stripe)
    client = return_env.client
    created = client.post("/api/returns/requests", json=_request_payload(), headers=_customer_headers())
    request_id = created.json()["idDevolucion"]
    approved = client.post(f"/api/returns/requests/{request_id}/approve", headers=_headers(permissions=["devolucion.gestionar"]))
    assert approved.status_code == 200
    assert approved.json()["estado"] == "aprobada"

    refunded = client.post(
        f"/api/returns/requests/{request_id}/refund", json={"comprobante": "TRF-0001"},
        headers=_headers(permissions=["devolucion.gestionar"]),
    )

    assert refunded.status_code == 200
    assert refunded.json()["estado"] == "reembolsada"
    assert refunded.json()["comprobanteTransferencia"] == "TRF-0001"
    assert refunded.json()["montoReembolso"] == 50
    assert called is False
