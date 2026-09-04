from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Cliente, Recomendaciones
from app.schemas.fase2 import RecomendacionIn, RecomendacionOut, RecomendacionUpdate
from app.security import get_current_payload, require_permiso

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=list[RecomendacionOut])
async def list_recommendations(
    idCliente: int | None = None,
    session: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_payload),
):
    permisos = payload.get("permisos", [])
    if "recomendacion.gestionar" in permisos:
        stmt = select(Recomendaciones).order_by(Recomendaciones.nombre)
        if idCliente is not None:
            stmt = stmt.where(Recomendaciones.idCliente == idCliente)
        rows = (await session.execute(stmt)).scalars().all()
        return rows

    user_id = int(payload["sub"])
    cliente = (
        await session.execute(select(Cliente).where(Cliente.idUser == user_id))
    ).scalar_one_or_none()
    if cliente is None:
        return []
    stmt = select(Recomendaciones).where(Recomendaciones.idCliente == cliente.idCliente)
    rows = (await session.execute(stmt)).scalars().all()
    return rows


@router.get("/{idRecomendacion}", response_model=RecomendacionOut)
async def get_recommendation(idRecomendacion: int, session: AsyncSession = Depends(get_db),
                             _=Depends(require_permiso("recomendacion.gestionar"))):
    r = await session.get(Recomendaciones, idRecomendacion)
    if not r:
        raise HTTPException(status_code=404, detail="Recomendacion no encontrada")
    return r


@router.post("", response_model=RecomendacionOut, status_code=201)
async def create_recommendation(
    payload: RecomendacionIn,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("recomendacion.gestionar")),
):
    if not await session.get(Cliente, payload.idCliente):
        raise HTTPException(status_code=400, detail="Cliente inexistente")
    r = Recomendaciones(**payload.model_dump())
    session.add(r)
    await session.commit()
    await session.refresh(r)
    return r


@router.put("/{idRecomendacion}", response_model=RecomendacionOut)
async def update_recommendation(
    idRecomendacion: int,
    payload: RecomendacionUpdate,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("recomendacion.gestionar")),
):
    r = await session.get(Recomendaciones, idRecomendacion)
    if not r:
        raise HTTPException(status_code=404, detail="Recomendacion no encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "idCliente" in data and not await session.get(Cliente, data["idCliente"]):
        raise HTTPException(status_code=400, detail="Cliente inexistente")
    for k, v in data.items():
        setattr(r, k, v)
    await session.commit()
    await session.refresh(r)
    return r


@router.delete("/{idRecomendacion}", status_code=204)
async def delete_recommendation(
    idRecomendacion: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("recomendacion.gestionar")),
):
    r = await session.get(Recomendaciones, idRecomendacion)
    if not r:
        raise HTTPException(status_code=404, detail="Recomendacion no encontrada")
    await session.delete(r)
    await session.commit()
