from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_platform_db, get_tenant_db
from app.models import Empresa, Plan, Producto, Rol, Sucursal, Suscripcion, Usuario
from app.security import get_current_payload, hash_password, validate_password_strength

router = APIRouter(tags=["tenant-platform"])
platform = APIRouter(prefix="/api/platform", tags=["platform"])
tenant = APIRouter(prefix="/api/tenant", tags=["tenant"])


class CreateAdmin(BaseModel):
    nombre: str
    correo: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class CreateEmpresa(BaseModel):
    nombre: str
    slug: str
    codigoPlan: str
    admin: CreateAdmin


class UpdateEmpresa(BaseModel):
    nombre: str | None = None
    logoUrl: str | None = None

    model_config = ConfigDict(extra="forbid")


class ChangePlan(BaseModel):
    codigoPlan: str
    # CU26: optional validity end date; Stripe-managed subscriptions take it from Stripe.
    fechaFin: date | None = None


class ChangeEstado(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, value: str) -> str:
        if value not in {"activa", "suspendida"}:
            raise ValueError("estado debe ser activa o suspendida")
        return value


def _plan_dict(plan: Plan) -> dict:
    return {"codigo": plan.codigo, "nombre": plan.nombre, "features": plan.features, "limites": plan.limites}


def _subscription_dict(subscription: Suscripcion) -> dict:
    return {"estado": subscription.estado, "fechaFin": subscription.fechaFin}


def _billing_dict(company: Empresa, subscription: Suscripcion) -> dict:
    stripe_subscription_id = getattr(subscription, "stripeSubscriptionId", None)
    cancels_at_end = bool(getattr(subscription, "cancelaAlFinal", False))
    return {
        "modo": "stripe" if stripe_subscription_id else "manual",
        "renovacionAutomatica": bool(stripe_subscription_id and not cancels_at_end),
        "proximoCobro": subscription.fechaFin if stripe_subscription_id else None,
        "cancelaAlFinal": cancels_at_end,
        "ciclo": getattr(subscription, "ciclo", "mensual"),
    }


async def _usage(session: AsyncSession, empresa_id: int) -> dict:
    result = {}
    for key, model in (("sucursales", Sucursal), ("usuarios", Usuario), ("productos", Producto)):
        result[key] = (await session.execute(
            select(func.count()).select_from(model).where(model.idEmpresa == empresa_id)
        )).scalar_one()
    return result


async def _company_context(session: AsyncSession, empresa_id: int):
    company = await session.get(Empresa, empresa_id)
    row = (await session.execute(
        select(Suscripcion, Plan).join(Plan, Plan.idPlan == Suscripcion.idPlan)
        .where(Suscripcion.idEmpresa == empresa_id)
    )).one_or_none()
    if company is None or row is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company, row[0], row[1]


@tenant.get("/me")
async def tenant_me(payload: dict = Depends(get_current_payload), session: AsyncSession = Depends(get_tenant_db)):
    empresa_id = payload.get("empresa")
    company, subscription, plan = await _company_context(session, empresa_id)
    return {
        "empresa": {"idEmpresa": company.idEmpresa, "nombre": company.nombre, "slug": company.slug, "logoUrl": company.logoUrl},
        "plan": _plan_dict(plan), "suscripcion": _subscription_dict(subscription),
        "facturacion": _billing_dict(company, subscription),
        "uso": await _usage(session, empresa_id),
    }


@platform.get("/plans")
async def list_plans(session: AsyncSession = Depends(get_platform_db)):
    rows = (await session.execute(select(Plan).order_by(Plan.idPlan))).scalars().all()
    return [{"idPlan": plan.idPlan, "codigo": plan.codigo, "nombre": plan.nombre,
             "precioMensual": float(plan.precioMensual), "precioAnual": float(plan.precioAnual),
             "features": plan.features, "limites": plan.limites}
            for plan in rows]


@platform.get("/empresas")
async def list_empresas(session: AsyncSession = Depends(get_platform_db)):
    rows = (await session.execute(
        select(Empresa, Suscripcion, Plan).join(Suscripcion, Suscripcion.idEmpresa == Empresa.idEmpresa)
        .join(Plan, Plan.idPlan == Suscripcion.idPlan).order_by(Empresa.idEmpresa)
    )).all()
    return [{"idEmpresa": company.idEmpresa, "nombre": company.nombre, "slug": company.slug,
             "logoUrl": company.logoUrl, "estado": company.estado,
             "plan": {"codigo": plan.codigo, "nombre": plan.nombre},
             "suscripcion": _subscription_dict(subscription),
             "facturacion": {"modo": "stripe" if subscription.stripeSubscriptionId else "manual",
                             "proximoCobro": subscription.fechaFin if subscription.stripeSubscriptionId else None,
                             "ciclo": subscription.ciclo},
             "uso": await _usage(session, company.idEmpresa)}
            for company, subscription, plan in rows]


@platform.post("/empresas", status_code=201)
async def create_empresa(payload: CreateEmpresa, session: AsyncSession = Depends(get_platform_db)):
    plan = (await session.execute(select(Plan).where(Plan.codigo == payload.codigoPlan))).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    admin_role = (await session.execute(select(Rol).where(Rol.nombreRol == "Administrador"))).scalar_one_or_none()
    if admin_role is None:
        raise HTTPException(status_code=500, detail="Rol Administrador no configurado")
    company = Empresa(nombre=payload.nombre, slug=payload.slug, estado="activa")
    session.add(company)
    try:
        await session.flush()
        session.add(Suscripcion(idEmpresa=company.idEmpresa, idPlan=plan.idPlan, estado="activa", fechaInicio=date.today()))
        session.add(Usuario(nombre=payload.admin.nombre, correo=str(payload.admin.correo), contraseña=hash_password(payload.admin.password),
                            codigoRol=admin_role.codigoRol, idEmpresa=company.idEmpresa))
        await session.commit()
        await session.refresh(company)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Empresa o correo ya existe")
    return {"idEmpresa": company.idEmpresa, "nombre": company.nombre, "slug": company.slug, "logoUrl": company.logoUrl}


@platform.patch("/empresas/{empresa_id}")
async def update_empresa(empresa_id: int, payload: UpdateEmpresa, session: AsyncSession = Depends(get_platform_db)):
    company = await session.get(Empresa, empresa_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    await session.commit()
    return {"idEmpresa": company.idEmpresa, "nombre": company.nombre, "slug": company.slug, "logoUrl": company.logoUrl}


@platform.patch("/empresas/{empresa_id}/plan")
async def change_plan(empresa_id: int, payload: ChangePlan, session: AsyncSession = Depends(get_platform_db)):
    _, subscription, _ = await _company_context(session, empresa_id)
    plan = (await session.execute(select(Plan).where(Plan.codigo == payload.codigoPlan))).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    if payload.fechaFin is not None and subscription.stripeSubscriptionId:
        raise HTTPException(status_code=409, detail={"code": "vigencia_gestionada_por_stripe"})
    if subscription.stripeSubscriptionId:
        from app.config import get_settings
        import anyio
        from app import stripe_provider

        settings = get_settings()
        if (not settings.STRIPE_SECRET_KEY or not settings.STRIPE_SECRET_KEY.startswith("sk_test_")
                or not (plan.stripePriceId if subscription.ciclo == "mensual" else plan.stripePriceIdAnual)):
            raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"})
        try:
            current = await anyio.to_thread.run_sync(lambda: stripe_provider.retrieve_subscription(
                subscription_id=subscription.stripeSubscriptionId, api_key=settings.STRIPE_SECRET_KEY))
            item = current["items"]["data"][0]
            price_id = plan.stripePriceId if subscription.ciclo == "mensual" else plan.stripePriceIdAnual
            await anyio.to_thread.run_sync(lambda: stripe_provider.update_subscription(
                api_key=settings.STRIPE_SECRET_KEY, subscription_id=subscription.stripeSubscriptionId,
                items=[{"id": item["id"], "price": price_id}], proration_behavior="create_prorations"))
        except stripe_provider.StripeError as exc:
            raise HTTPException(status_code=502, detail={"code": "stripe_request_failed"}) from exc
    subscription.idPlan = plan.idPlan
    if payload.fechaFin is not None:
        subscription.fechaFin = payload.fechaFin
    await session.commit()
    return {"codigoPlan": plan.codigo, "fechaFin": subscription.fechaFin}


@platform.patch("/empresas/{empresa_id}/estado")
async def change_estado(empresa_id: int, payload: ChangeEstado, session: AsyncSession = Depends(get_platform_db)):
    company, subscription, _ = await _company_context(session, empresa_id)
    company.estado = payload.estado
    subscription.estado = payload.estado
    await session.commit()
    return {"estado": payload.estado}


router.include_router(tenant)
router.include_router(platform)
