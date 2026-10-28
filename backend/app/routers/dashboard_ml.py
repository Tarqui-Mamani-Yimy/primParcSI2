from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.schemas.dashboard_ml import (
    CustomerSegmentsOut,
    ProductTrendsOut,
    SalesForecastOut,
    StockoutRiskOut,
)
from app.security import require_permiso
from app.services import ml_proyecciones

router = APIRouter(prefix="/api/dashboard/ml", tags=["dashboard-ml"])


def _tenant_id_for_admin(auth: dict) -> int:
    role = str(auth.get("rol", "")).strip().casefold()
    if role not in {"admin", "administrador"}:
        raise HTTPException(
            status_code=403,
            detail={"code": "admin_only", "message": "Solo Admin puede consultar proyecciones."},
        )
    try:
        tenant_id = int(auth["empresa"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=403, detail="El usuario no tiene una empresa asociada.") from exc
    if tenant_id <= 0:
        raise HTTPException(status_code=403, detail="El usuario no tiene una empresa asociada.")
    return tenant_id


@router.get("/sales-forecast", response_model=SalesForecastOut)
async def sales_forecast(
    days: int = Query(30, ge=7, le=90),
    branch_id: int | None = None,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    tenant_id = _tenant_id_for_admin(auth)
    return await ml_proyecciones.ventas_futuras(session, tenant_id, days, branch_id)


@router.get("/stockout-risk", response_model=StockoutRiskOut)
async def stockout_risk(
    branch_id: int | None = None,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    tenant_id = _tenant_id_for_admin(auth)
    return await ml_proyecciones.riesgo_quiebre_stock(session, tenant_id, branch_id)


@router.get("/product-trends", response_model=ProductTrendsOut)
async def product_trends(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    tenant_id = _tenant_id_for_admin(auth)
    return await ml_proyecciones.tendencias_productos(session, tenant_id)


@router.get("/customer-segments", response_model=CustomerSegmentsOut)
async def customer_segments(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    tenant_id = _tenant_id_for_admin(auth)
    return await ml_proyecciones.segmentar_clientes(session, tenant_id)
