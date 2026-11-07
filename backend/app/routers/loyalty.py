from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.models import Cliente, CuentaPuntos, MovimientoPuntos
from app.security import get_current_payload, require_permiso
from app.services.pricing import nivel_puntos

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])


async def _loyalty_summary(session, tenant_id: int, customer_id: int, *, history: bool) -> dict:
    account_result = await session.execute(
        select(CuentaPuntos).where(
            CuentaPuntos.idCliente == customer_id,
            CuentaPuntos.idEmpresa == tenant_id,
        )
    )
    account = account_result.scalar_one_or_none()
    balance = int(account.saldo) if account else 0
    historical = int(account.acumulado_historico) if account else 0
    level = nivel_puntos(historical)
    next_level = level["siguiente_nivel"]
    result = {
        "saldo": balance,
        "acumulado_historico": historical,
        "nivel": level["nivel"],
        "multiplicador": level["multiplicador"],
        "siguiente_nivel": next_level,
        "puntos_para_siguiente": level["puntos_para_siguiente"],
    }
    if history:
        rows = await session.execute(
            select(MovimientoPuntos)
            .where(
                MovimientoPuntos.idEmpresa == tenant_id,
                MovimientoPuntos.idCliente == customer_id,
            )
            .order_by(MovimientoPuntos.fecha.desc(), MovimientoPuntos.idMovimientoPuntos.desc())
        )
        result["movimientos"] = [
            {
                "idMovimientoPuntos": row.idMovimientoPuntos,
                "idVenta": row.idVenta,
                "tipo": row.tipo,
                "puntos": row.puntos,
                "fecha": row.fecha,
                "nota": row.nota,
            }
            for row in rows.scalars().all()
        ]
    return result


@router.get("/me")
async def my_loyalty(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(get_current_payload),
):
    tenant_id = int(auth["empresa"])
    customer_result = await session.execute(
        select(Cliente).where(
            Cliente.idEmpresa == tenant_id,
            Cliente.idUser == int(auth["sub"]),
        )
    )
    customer = customer_result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return await _loyalty_summary(session, tenant_id, customer.idCliente, history=True)


@router.get("/customers/{customer_id}")
async def customer_loyalty(
    customer_id: int,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("venta.crear")),
):
    tenant_id = int(auth["empresa"])
    customer = await session.get(Cliente, customer_id)
    if customer is None or customer.idEmpresa != tenant_id:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return await _loyalty_summary(session, tenant_id, customer_id, history=False)
