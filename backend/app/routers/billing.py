"""Tenant Stripe Billing endpoints and signature-verified webhook handling."""

import hashlib
import hmac
import json
import logging
import time
import re
import secrets
from urllib.parse import quote
from collections import defaultdict, deque
from datetime import date, datetime, timezone

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_auth_db, get_billing_webhook_db, get_tenant_db
from app.models import Empresa, Plan, Rol, Suscripcion, Usuario
from app.security import create_pwd_reset_token, get_current_payload, hash_password, require_permiso
from app.email_utils import send_reset_email
from app import stripe_provider

router = APIRouter(prefix="/api/billing", tags=["billing"])
public_router = APIRouter(prefix="/api/public", tags=["public"])
logger = logging.getLogger("app.billing")
_signup_requests = defaultdict(deque)
_SIGNUP_RATE_LIMIT = 5
_SIGNUP_RATE_WINDOW = 3600


class CheckoutIn(BaseModel):
    codigoPlan: str
    ciclo: str = "mensual"

    @field_validator("ciclo")
    @classmethod
    def validate_cycle(cls, value):
        if value not in {"mensual", "anual"}:
            raise ValueError("invalid cycle")
        return value


class PublicSignupIn(BaseModel):
    empresa: str = Field(min_length=2, max_length=150)
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr
    codigoPlan: str
    ciclo: str



def _require_stripe() -> str:
    key = get_settings().STRIPE_SECRET_KEY
    if not key or not key.startswith("sk_test_"):
        raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"})
    return key


def create_signup_checkout(*, api_key: str, price_id: str, metadata: dict,
                           success_url: str, cancel_url: str) -> str:
    checkout = stripe_provider.create_checkout_session(
        api_key=api_key, mode="subscription", line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
        subscription_data={"metadata": metadata},
    )
    return checkout.url


def send_welcome_email(email: str, name: str, link: str) -> bool:
    """Use the existing Brevo reset-email transport for a password-set link."""
    return send_reset_email(email, link, welcome_name=name)


async def _create_signup_account(session: AsyncSession, metadata: dict, customer_id: str,
                                 subscription_id: str, period_end: int | None):
    email = str(metadata.get("correo", "")).strip().lower()
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:email, 0))"), {"email": email})
    existing = (await session.execute(select(Usuario.idUser).where(func.lower(Usuario.correo) == email))).scalar_one_or_none()
    if existing is not None:
        logger.warning("Signup webhook email conflict for checkout %s", metadata.get("checkout_session_id", "unknown"))
        await session.execute(text("""INSERT INTO signup_conflicto (checkout_session_id, correo)
            VALUES (:checkout, :email) ON CONFLICT (checkout_session_id) DO NOTHING"""),
            {"checkout": metadata.get("checkout_session_id", "unknown"), "email": email})
        return None
    plan = (await session.execute(select(Plan).where(Plan.codigo == metadata.get("codigoPlan")))).scalar_one_or_none()
    role = (await session.execute(select(Rol).where(Rol.nombreRol == "Administrador"))).scalar_one_or_none()
    if plan is None or role is None:
        raise ValueError("Signup plan or administrator role is unavailable")
    base = re.sub(r"[^a-z0-9]+", "-", metadata.get("empresa", "empresa").lower()).strip("-") or "empresa"
    suffix = hashlib.sha256(email.encode()).hexdigest()[:16]
    slug = f"{base[:88].rstrip('-')}-{suffix}"
    company = Empresa(nombre=metadata["empresa"], slug=slug, estado="activa", stripeCustomerId=customer_id)
    session.add(company)
    await session.flush()
    end_date = datetime.fromtimestamp(period_end, timezone.utc).date() if period_end else None
    subscription = Suscripcion(idEmpresa=company.idEmpresa, idPlan=plan.idPlan, estado="activa",
                               fechaInicio=date.today(), fechaFin=end_date, stripeSubscriptionId=subscription_id,
                               ciclo=metadata.get("ciclo", "mensual"))
    session.add(subscription)
    # Store only an unusable random secret; the customer receives a 48-hour set-password link.
    user = Usuario(nombre=metadata["nombre"], correo=email,
                   contraseña=hash_password(secrets.token_urlsafe(48)), codigoRol=role.codigoRol,
                   idEmpresa=company.idEmpresa)
    session.add(user)
    await session.flush()
    return {"idUser": user.idUser, "correo": email, "nombre": user.nombre}


async def _handle_signup_checkout(session: AsyncSession, obj: dict):
    metadata = dict(obj.get("metadata") or {})
    if metadata.get("tipo") != "signup":
        return
    required = {"empresa", "nombre", "correo", "codigoPlan", "ciclo"}
    if not required.issubset(metadata) or metadata["ciclo"] not in {"mensual", "anual"}:
        logger.warning("Ignoring malformed signup checkout metadata")
        return
    subscription_id = obj.get("subscription")
    if not subscription_id:
        logger.warning("Signup checkout completed without subscription id")
        return
    email = str(metadata["correo"]).strip().lower()
    metadata["checkout_session_id"] = obj.get("id", "unknown")
    period_end = obj.get("current_period_end")
    if not period_end:
        try:
            subscription = await anyio.to_thread.run_sync(lambda: stripe_provider.retrieve_subscription(
                api_key=get_settings().STRIPE_SECRET_KEY, subscription_id=subscription_id))
            period_end = stripe_provider.subscription_period_end(subscription)
        except Exception:
            logger.exception("Could not retrieve signup subscription period end")
    user = await _create_signup_account(session, metadata, obj.get("customer"), subscription_id, period_end)
    if user is None:
        await session.commit()
        return
    token = create_pwd_reset_token(user["idUser"], expires_minutes=48 * 60)
    link = f"{get_settings().FRONTEND_URL.rstrip('/')}/?reset_token={quote(token, safe='')}&bienvenida=1"
    await session.commit()
    try:
        if not send_welcome_email(email, user["nombre"], link):
            logger.warning("Welcome email unavailable for signup user %s", user["idUser"])
    except Exception:
        logger.exception("Welcome email failed for signup user %s", user["idUser"])


@public_router.get("/plans")
async def public_plans(session: AsyncSession = Depends(get_auth_db)):
    plans = (await session.execute(select(Plan).order_by(Plan.idPlan))).scalars().all()
    return [{"codigo": p.codigo, "nombre": p.nombre, "precioMensual": float(p.precioMensual),
             "precioAnual": float(p.precioAnual), "features": p.features, "limites": p.limites}
            for p in plans]


@public_router.post("/signup")
async def public_signup(payload: PublicSignupIn, request: Request = None,
                        session: AsyncSession = Depends(get_auth_db)):
    if payload.codigoPlan not in {"basico", "intermedio", "avanzado"}:
        raise HTTPException(status_code=422, detail={"code": "invalid_plan"})
    if payload.ciclo not in {"mensual", "anual"}:
        raise HTTPException(status_code=422, detail={"code": "invalid_plan"})
    ip = request.client.host if request and request.client else "unknown"
    now = time.monotonic()
    bucket = _signup_requests[ip]
    while bucket and now - bucket[0] > _SIGNUP_RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= _SIGNUP_RATE_LIMIT:
        raise HTTPException(status_code=429, detail={"code": "too_many_requests"})
    bucket.append(now)

    key = _require_stripe()
    email = str(payload.correo).strip().lower()
    exists = await session.execute(select(Usuario.idUser).where(func.lower(Usuario.correo) == email))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail={"code": "email_in_use"})
    plan = (await session.execute(select(Plan).where(Plan.codigo == payload.codigoPlan))).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=422, detail={"code": "invalid_plan"})
    price_id = plan.stripePriceId if payload.ciclo == "mensual" else plan.stripePriceIdAnual
    if not price_id:
        raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"})
    metadata = {"tipo": "signup", "empresa": payload.empresa.strip(), "nombre": payload.nombre.strip(),
                "correo": email, "codigoPlan": payload.codigoPlan, "ciclo": payload.ciclo}
    frontend = get_settings().FRONTEND_URL.rstrip("/")
    try:
        url = await anyio.to_thread.run_sync(lambda: create_signup_checkout(
            api_key=key, price_id=price_id, metadata=metadata,
            success_url=f"{frontend}/?signup=success&correo={quote(email, safe='')}",
            cancel_url=f"{frontend}/?signup=cancel"))
    except stripe_provider.StripeError as exc:
        raise HTTPException(status_code=502, detail={"code": "stripe_request_failed"}) from exc
    return {"url": url}


@router.post("/checkout")
async def create_checkout(payload: CheckoutIn, auth: dict = Depends(require_permiso("suscripcion.gestionar")),
                          session: AsyncSession = Depends(get_tenant_db)):
    key = _require_stripe()
    company_id = auth["empresa"]
    company = await session.get(Empresa, company_id)
    row = (await session.execute(select(Suscripcion, Plan).join(Plan, Plan.idPlan == Suscripcion.idPlan)
                                 .where(Suscripcion.idEmpresa == company_id))).one_or_none()
    plan = (await session.execute(select(Plan).where(Plan.codigo == payload.codigoPlan))).scalar_one_or_none()
    if not company or not row:
        raise HTTPException(status_code=404, detail={"code": "subscription_not_found"})
    if not plan:
        raise HTTPException(status_code=404, detail={"code": "plan_not_found"})
    if row[0].stripeSubscriptionId and row[0].estado == "activa":
        raise HTTPException(status_code=409, detail={"code": "billing_already_active"})
    def create_session():
        customer_id = company.stripeCustomerId
        if not customer_id:
            customer = stripe_provider.create_customer(api_key=key, name=company.nombre,
                                                       metadata={"empresa_id": str(company_id)})
            customer_id = customer.id
        price_id = plan.stripePriceId if payload.ciclo == "mensual" else plan.stripePriceIdAnual
        if not price_id:
            raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"})
        interval = payload.ciclo
        checkout = stripe_provider.create_checkout_session(
            api_key=key,
            mode="subscription", customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{get_settings().FRONTEND_URL}/?billing=success",
            cancel_url=f"{get_settings().FRONTEND_URL}/?billing=cancel",
            client_reference_id=str(company_id),
            metadata={"empresa_id": str(company_id), "plan_codigo": plan.codigo, "ciclo": payload.ciclo},
            subscription_data={"metadata": {"empresa_id": str(company_id), "plan_codigo": plan.codigo, "ciclo": interval}},
        )
        return customer_id, checkout.url

    try:
        customer_id, url = await anyio.to_thread.run_sync(create_session)
    except stripe_provider.StripeError as exc:
        raise HTTPException(status_code=502, detail={"code": "stripe_request_failed"}) from exc
    company.stripeCustomerId = customer_id
    await session.commit()
    return {"url": url}


@router.post("/portal")
async def create_portal(auth: dict = Depends(require_permiso("suscripcion.gestionar")),
                        session: AsyncSession = Depends(get_tenant_db)):
    key = _require_stripe()
    company = await session.get(Empresa, auth["empresa"])
    if not company or not company.stripeCustomerId:
        raise HTTPException(status_code=409, detail={"code": "billing_not_configured"})
    try:
        portal = await anyio.to_thread.run_sync(lambda: stripe_provider.create_portal_session(
            api_key=key, customer=company.stripeCustomerId, return_url=f"{get_settings().FRONTEND_URL}/"))
    except stripe_provider.StripeError as exc:
        raise HTTPException(status_code=502, detail={"code": "stripe_request_failed"}) from exc
    return {"url": portal.url}


def verify_stripe_signature(payload: bytes, signature_header: str, secret: str) -> dict:
    """Verify Stripe's timestamped HMAC signature and parse the event body."""
    fields = {}
    for item in signature_header.split(","):
        key, sep, value = item.partition("=")
        if sep:
            fields.setdefault(key.strip(), []).append(value.strip())
    try:
        timestamp = int(fields["t"][0])
    except (KeyError, ValueError, IndexError) as exc:
        raise ValueError("Invalid Stripe signature") from exc
    if abs(time.time() - timestamp) > 300:
        raise ValueError("Expired Stripe signature")
    signed = str(timestamp).encode() + b"." + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, candidate) for candidate in fields.get("v1", [])):
        raise ValueError("Invalid Stripe signature")
    try:
        return json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid Stripe payload") from exc


async def process_stripe_webhook(payload: bytes, signature: str, session: AsyncSession, secret: str) -> bool:
    """Apply one verified event exactly once; return True for a duplicate."""
    event = verify_stripe_signature(payload, signature, secret)
    event_id, event_type = event.get("id"), event.get("type")
    if not event_id or not event_type:
        raise ValueError("Invalid Stripe event")
    claimed = await session.execute(text("""INSERT INTO stripe_evento (event_id, event_type)
        VALUES (:event_id, :event_type) ON CONFLICT (event_id) DO NOTHING RETURNING event_id"""),
        {"event_id": event_id, "event_type": event_type})
    if claimed.scalar_one_or_none() is None:
        return True
    obj = (event.get("data") or {}).get("object") or {}
    customer_id = obj.get("customer")
    subscription_id = obj.get("subscription") or (obj.get("id") if event_type.startswith("customer.subscription.") else None)

    signup_committed = False
    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        if metadata.get("tipo") == "signup":
            await _handle_signup_checkout(session, obj)
            signup_committed = True
        else:
            empresa_id = metadata.get("empresa_id") or obj.get("client_reference_id")
            if empresa_id and obj.get("subscription"):
                await session.execute(text('''UPDATE "Empresa" SET "stripeCustomerId" = :customer
                    WHERE "idEmpresa" = :empresa_id'''), {"customer": customer_id, "empresa_id": int(empresa_id)})
                await session.execute(text('''UPDATE "Suscripcion" SET "stripeSubscriptionId" = :subscription,
                    "idPlan" = COALESCE((SELECT "idPlan" FROM "Plan" WHERE "codigo" = :plan_codigo), "idPlan"),
                    "ciclo" = COALESCE(:ciclo, "ciclo")
                    WHERE "idEmpresa" = :empresa_id'''), {"subscription": obj["subscription"], "empresa_id": int(empresa_id),
                                                           "plan_codigo": metadata.get("plan_codigo"), "ciclo": metadata.get("ciclo")})
    elif event_type == "invoice.paid":
        parent = obj.get("parent") or {}
        subscription_details = parent.get("subscription_details") or {}
        subscription_id = subscription_id or subscription_details.get("subscription")
        lines = (obj.get("lines") or {}).get("data") or []
        period_end = next((line.get("period", {}).get("end") for line in lines if line.get("period", {}).get("end")), None)
        if subscription_id:
            await session.execute(text('''UPDATE "Suscripcion" SET "estado" = 'activa', "fechaFin" = :end_date
                WHERE "stripeSubscriptionId" = :subscription'''), {"end_date": datetime.fromtimestamp(period_end, timezone.utc).date() if period_end else None,
                                                                      "subscription": subscription_id})
    elif event_type == "customer.subscription.updated":
        status = obj.get("status")
        state = "activa" if status in {"active", "trialing"} else "suspendida" if status in {"canceled", "unpaid", "incomplete_expired"} else "activa"
        end = obj.get("current_period_end")
        items = (obj.get("items") or {}).get("data") or []
        price = (items[0].get("price") or {}) if items else {}
        price_id = price.get("id") if isinstance(price, dict) else price
        await session.execute(text('''UPDATE "Suscripcion" SET "estado" = :state, "cancelaAlFinal" = :cancel,
            "fechaFin" = COALESCE(:end_date, "fechaFin"),
            "idPlan" = COALESCE((SELECT "idPlan" FROM "Plan" WHERE "stripePriceId" = :price_id
                                 OR "stripePriceIdAnual" = :price_id), "idPlan"),
            "ciclo" = CASE WHEN EXISTS (SELECT 1 FROM "Plan" WHERE "stripePriceIdAnual" = :price_id)
                           THEN 'anual' ELSE 'mensual' END
            WHERE "stripeSubscriptionId" = :subscription'''),
            {"state": state, "cancel": bool(obj.get("cancel_at_period_end")),
             "end_date": datetime.fromtimestamp(end, timezone.utc).date() if end else None,
             "price_id": price_id, "subscription": subscription_id})
    elif event_type == "customer.subscription.deleted":
        await session.execute(text('''UPDATE "Suscripcion" SET "estado" = 'vencida', "cancelaAlFinal" = FALSE
            WHERE "stripeSubscriptionId" = :subscription'''), {"subscription": subscription_id})

    if not signup_committed:
        await session.commit()
    return False


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_billing_webhook_db)):
    secret = get_settings().STRIPE_WEBHOOK_SECRET
    signature = request.headers.get("stripe-signature", "")
    if not secret:
        raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"})
    try:
        duplicate = await process_stripe_webhook(await request.body(), signature, session, secret)
    except ValueError as exc:
        logger.warning("Rejected Stripe webhook payload: %s", exc)
        raise HTTPException(status_code=400, detail={"code": "invalid_stripe_signature"}) from exc
    return {"received": True, "duplicate": duplicate}
