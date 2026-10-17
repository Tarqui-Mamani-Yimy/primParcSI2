import asyncio
import hashlib
import hmac
import json
import time

import pytest

from app.routers.billing import process_stripe_webhook


class FakeSession:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.events = set()
        self.statements = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append((sql, params or {}))
        if "INSERT INTO stripe_evento" in sql:
            if params["event_id"] in self.events:
                return Result(None)
            self.events.add(params["event_id"])
            return Result(params["event_id"])
        if "FROM \"Empresa\"" in sql:
            return Result({"idEmpresa": 41, "stripeCustomerId": "cus_test"})
        if "FROM \"Suscripcion\"" in sql:
            return Result({"idSuscripcion": 7, "idPlan": 1, "stripeSubscriptionId": "sub_test"})
        return Result(None)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def first(self):
        return self.value


def signed_payload(event):
    payload = json.dumps(event, separators=(",", ":")).encode()
    timestamp = int(time.time())
    signed = f"{timestamp}.".encode() + payload
    signature = hmac.new(b"whsec_test", signed, hashlib.sha256).hexdigest()
    return payload, f"t={timestamp},v1={signature}"


def test_webhook_rejects_invalid_signature():
    from app.routers.billing import verify_stripe_signature

    payload, _ = signed_payload({"id": "evt_test", "type": "invoice.paid", "data": {"object": {}}})
    with pytest.raises(ValueError):
        verify_stripe_signature(payload, "t=1,v1=invalid", "whsec_test")


def test_webhook_deduplicates_event_ids():
    event = {"id": "evt_test", "type": "unhandled.event", "data": {"object": {}}}
    payload, signature = signed_payload(event)
    session = FakeSession()

    async def run():
        first = await process_stripe_webhook(payload, signature, session, "whsec_test")
        second = await process_stripe_webhook(payload, signature, session, "whsec_test")
        return first, second

    assert asyncio.run(run()) == (False, True)
    assert session.events == {"evt_test"}
    assert session.commits == 1


def test_invoice_paid_activates_subscription_through_period_end():
    end = 1794873600
    event = {"id": "evt_paid", "type": "invoice.paid", "data": {"object": {
        "customer": "cus_test", "subscription": "sub_test",
        "lines": {"data": [{"period": {"end": end}}]},
    }}}
    payload, signature = signed_payload(event)
    session = FakeSession()
    assert asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test")) is False
    update = next((sql, params) for sql, params in session.statements if 'UPDATE "Suscripcion"' in sql)
    assert "'activa'" in update[0]
    assert update[1]["subscription"] == "sub_test"
    assert update[1]["end_date"].isoformat() == "2026-11-17"


def test_subscription_deleted_marks_subscription_expired():
    event = {"id": "evt_deleted", "type": "customer.subscription.deleted", "data": {"object": {
        "id": "sub_test", "customer": "cus_test", "status": "canceled",
    }}}
    payload, signature = signed_payload(event)
    session = FakeSession()
    asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test"))
    update = next(sql for sql, _ in session.statements if 'UPDATE "Suscripcion"' in sql)
    assert "'vencida'" in update


def test_invoice_paid_with_nullable_parent_is_still_recorded():
    event = {"id": "evt_paid_no_subscription", "type": "invoice.paid", "data": {"object": {
        "customer": "cus_test", "subscription": None, "parent": None,
    }}}
    payload, signature = signed_payload(event)
    session = FakeSession()
    assert asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test")) is False
    assert session.events == {"evt_paid_no_subscription"}


def test_subscription_update_syncs_plan_by_stripe_price():
    event = {"id": "evt_updated", "type": "customer.subscription.updated", "data": {"object": {
        "id": "sub_test", "customer": "cus_test", "status": "active", "cancel_at_period_end": True,
        "items": {"data": [{"price": {"id": "price_intermedio"}}]},
    }}}
    payload, signature = signed_payload(event)
    session = FakeSession()
    asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test"))
    update = next((sql, params) for sql, params in session.statements if 'UPDATE "Suscripcion"' in sql)
    assert '"stripePriceId" = :price_id' in update[0]
    assert update[1]["price_id"] == "price_intermedio"
    assert update[1]["cancel"] is True


@pytest.mark.parametrize("data", [
    {"id": "sub_test", "object": "subscription", "current_period_end": 1_800_000_000,
     "items": {"object": "list", "data": []}},
    {"id": "sub_test", "object": "subscription",
     "items": {"object": "list", "data": [{"current_period_end": 1_800_000_000}]}},
])
def test_signup_checkout_persists_period_end_from_stripe_sdk_object(monkeypatch, data):
    import stripe
    import app.routers.billing as billing
    from types import SimpleNamespace

    subscription = stripe.Subscription.construct_from(data, "sk_test_fake")
    monkeypatch.setattr(billing.stripe_provider, "retrieve_subscription", lambda **_: subscription)
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(
        STRIPE_SECRET_KEY="sk_test_fake", FRONTEND_URL="https://shop.example"))
    monkeypatch.setattr(billing, "send_welcome_email", lambda *args: True)
    monkeypatch.setattr(billing, "create_pwd_reset_token", lambda *args, **kwargs: "opaque-token")
    session = FakeSignupSession()
    checkout = {
        "id": "cs_test_signup", "customer": "cus_test", "subscription": "sub_test",
        "metadata": {"tipo": "signup", "empresa": "Moda Andina", "nombre": "Ana Pérez",
                     "correo": "ana@example.com", "codigoPlan": "basico", "ciclo": "mensual"},
    }

    asyncio.run(billing._handle_signup_checkout(session, checkout))

    stored = next(obj for obj in session.objects if obj.__class__.__name__ == "Suscripcion")
    from datetime import datetime, timezone
    assert stored.fechaFin == datetime.fromtimestamp(1_800_000_000, timezone.utc).date()


def test_billing_mutations_bypass_inactive_subscription_guard():
    from types import SimpleNamespace
    from app.security import require_active_subscription

    dependency = require_active_subscription()
    session = FakeSession()
    result = asyncio.run(dependency(
        request=SimpleNamespace(method="POST", url=SimpleNamespace(path="/api/billing/checkout")),
        payload={"empresa": 41}, session=session,
    ))
    assert result is None
    assert session.statements == []


def test_billing_rejects_live_mode_keys(monkeypatch):
    from types import SimpleNamespace
    from fastapi import HTTPException
    import app.routers.billing as billing

    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(STRIPE_SECRET_KEY="sk_live_not_allowed"))
    with pytest.raises(HTTPException) as raised:
        billing._require_stripe()
    assert raised.value.status_code == 503
    assert raised.value.detail == {"code": "stripe_not_configured"}


@pytest.mark.parametrize("mail_result", [True, False])
def test_signup_webhook_creates_account_only_after_signed_payment_and_sends_set_password_email(monkeypatch, mail_result):
    import app.routers.billing as billing

    session = FakeSignupSession()
    mailed = []
    def send_welcome(email, name, link):
        mailed.append((email, name, link))
        return mail_result
    monkeypatch.setattr(billing, "send_welcome_email", send_welcome)
    async def create_account(session_arg, *args):
        session_arg.created.extend(["empresa", "suscripcion", "usuario"])
        return {"idUser": 91, "correo": "ana@example.com", "nombre": "Ana Pérez"}
    monkeypatch.setattr(billing, "_create_signup_account", create_account)
    monkeypatch.setattr(billing, "create_pwd_reset_token", lambda user_id, expires_minutes: 
                        (setattr(session, "reset_expiry_hours", expires_minutes // 60) or "opaque-token"))
    monkeypatch.setattr(billing.stripe_provider, "retrieve_subscription", lambda **_: {"current_period_end": 1794873600})
    event = {"id": "evt_signup", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_test_signup", "customer": "cus_new", "subscription": "sub_new",
        "customer_details": {"email": "ana@example.com"},
        "metadata": {"tipo": "signup", "empresa": "Moda Andina", "nombre": "Ana Pérez",
                      "correo": "ana@example.com", "codigoPlan": "basico", "ciclo": "anual"},
    }}}
    payload, signature = signed_payload(event)
    assert asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test")) is False
    assert asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test")) is True
    assert session.created == ["empresa", "suscripcion", "usuario"]
    assert session.commits == 1
    assert len(mailed) == 1
    assert "reset_token=" in mailed[0][2] and "bienvenida=1" in mailed[0][2]
    assert session.reset_expiry_hours == 48


class FakeSignupSession(FakeSession):
    def __init__(self):
        super().__init__()
        self.created = []
        self.reset_expiry_hours = None
        self.email_exists = False
        self.objects = []
        self.flushes = 0

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append((sql, params or {}))
        if "INSERT INTO stripe_evento" in sql:
            if params["event_id"] in self.events:
                return Result(None)
            self.events.add(params["event_id"])
            return Result(params["event_id"])
        if '"Usuario"' in sql:
            return Result(81 if self.email_exists else None)
        if '"Plan"' in sql:
            from types import SimpleNamespace
            return Result(SimpleNamespace(idPlan=1, codigo="basico", nombre="Básico", precioMensual=290,
                                          precioAnual=2784, stripePriceId="price_month", stripePriceIdAnual="price_year",
                                          features=[], limites={}))
        if 'FROM rol' in sql:
            from types import SimpleNamespace
            return Result(SimpleNamespace(codigoRol=1, nombreRol="Administrador"))
        return Result(None)

    def add(self, obj):
        self.objects.append(obj)

    async def flush(self):
        self.flushes += 1
        if self.flushes == 1:
            for obj in self.objects:
                if hasattr(obj, "idEmpresa") and obj.__class__.__name__ == "Empresa":
                    obj.idEmpresa = 55
        else:
            for obj in self.objects:
                if obj.__class__.__name__ == "Usuario":
                    obj.idUser = 91

    async def create_signup_account(self, metadata, customer_id, subscription_id, period_end):
        self.created.extend(["empresa", "suscripcion", "usuario"])
        return {"idUser": 91, "correo": metadata["correo"], "nombre": metadata["nombre"]}


def test_public_signup_contract_does_not_persist_before_checkout(monkeypatch):
    from types import SimpleNamespace
    import app.routers.billing as billing

    session = FakeSignupSession()
    created = []
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(
        STRIPE_SECRET_KEY="sk_test_fake", FRONTEND_URL="https://shop.example"))
    monkeypatch.setattr(billing, "create_signup_checkout", lambda **kwargs: created.append(kwargs) or "https://checkout.stripe.com/cs_test")
    payload = billing.PublicSignupIn(empresa="Moda Andina", nombre="Ana Pérez", correo="ana@example.com",
                                     codigoPlan="basico", ciclo="anual")
    response = asyncio.run(billing.public_signup(payload, session=session))
    assert response == {"url": "https://checkout.stripe.com/cs_test"}
    assert session.created == []
    assert created[0]["metadata"]["tipo"] == "signup"
    assert created[0]["success_url"] == "https://shop.example/?signup=success&correo=ana%40example.com"


def test_signup_email_conflict_is_logged_and_never_creates_duplicate(monkeypatch):
    import app.routers.billing as billing

    session = FakeSignupSession()
    session.email_exists = True
    monkeypatch.setattr(billing, "send_welcome_email", lambda *_: pytest.fail("must not email conflict"))
    event = {"id": "evt_signup_conflict", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_conflict", "customer": "cus_new", "subscription": "sub_new", "current_period_end": 1794873600,
        "metadata": {"tipo": "signup", "empresa": "Moda Andina", "nombre": "Ana Pérez",
                      "correo": "ana@example.com", "codigoPlan": "basico", "ciclo": "mensual"},
    }}}
    payload, signature = signed_payload(event)
    assert asyncio.run(process_stripe_webhook(payload, signature, session, "whsec_test")) is False
    assert session.created == []
    assert any("signup_conflicto" in sql for sql, _ in session.statements)


def test_signup_account_is_created_by_webhook_with_cycle_and_unusable_password():
    from app.routers.billing import _create_signup_account

    session = FakeSignupSession()
    metadata = {"empresa": "Moda Andina", "nombre": "Ana Pérez", "correo": "ana@example.com",
                "codigoPlan": "basico", "ciclo": "anual", "checkout_session_id": "cs_test"}
    result = asyncio.run(_create_signup_account(session, metadata, "cus_test", "sub_test", 1794873600))
    assert result["idUser"] == 91
    company = next(o for o in session.objects if o.__class__.__name__ == "Empresa")
    subscription = next(o for o in session.objects if o.__class__.__name__ == "Suscripcion")
    user = next(o for o in session.objects if o.__class__.__name__ == "Usuario")
    assert company.idEmpresa == subscription.idEmpresa == user.idEmpresa == 55
    assert subscription.ciclo == "anual" and subscription.stripeSubscriptionId == "sub_test"
    assert user.contraseña != "" and not user.contraseña.startswith("Ana")


def test_public_signup_returns_documented_invalid_plan_shape_without_checkout(monkeypatch):
    from types import SimpleNamespace
    from fastapi import HTTPException
    import app.routers.billing as billing

    payload = billing.PublicSignupIn(empresa="Empresa válida", nombre="Nombre válido",
                                     correo="valid@example.com", codigoPlan="desconocido", ciclo="mensual")
    monkeypatch.setattr(billing, "get_settings", lambda: SimpleNamespace(STRIPE_SECRET_KEY="sk_test_fake"))
    with pytest.raises(HTTPException) as raised:
        asyncio.run(billing.public_signup(payload, session=FakeSignupSession()))
    assert raised.value.status_code == 422
    assert raised.value.detail == {"code": "invalid_plan"}
