from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.models import Cliente, Colecciones, Cupon, Producto, Promocion
from app.schemas.promotions import CuponIn, PromocionIn
from app.security import get_current_payload, get_plan_features, require_feature, require_permiso

router = APIRouter(tags=["promotions"])


def _tenant(auth: dict) -> int:
    return int(auth["empresa"])


def _active_now(start: datetime, end: datetime, now: datetime) -> bool:
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return start <= now <= end


@router.get("/api/promotions/active")
async def active_promotions(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(get_current_payload),
):
    if "promociones" not in await get_plan_features(session, _tenant(auth)):
        return []
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(Promocion)
        .where(Promocion.idEmpresa == _tenant(auth), Promocion.activa.is_(True))
        .order_by(Promocion.idPromocion)
    )
    promotions = [promotion for promotion in result.scalars().all()
                  if _active_now(promotion.fecha_inicio, promotion.fecha_fin, now)]
    serialized = []
    tenant_id = _tenant(auth)
    for promotion in promotions:
        products = None
        if promotion.alcance != "todos":
            query = select(Producto.idProducto).where(Producto.idEmpresa == tenant_id)
            if promotion.alcance == "producto":
                try:
                    product_id = int(promotion.alcance_ref or "")
                except ValueError:
                    product_id = -1
                query = query.where(Producto.idProducto == product_id)
            elif promotion.alcance == "coleccion":
                try:
                    collection_id = int(promotion.alcance_ref or "")
                except ValueError:
                    collection_id = -1
                query = query.where(Producto.idColeccion == collection_id)
            elif promotion.alcance == "temporada":
                try:
                    season_id = int(promotion.alcance_ref or "")
                except ValueError:
                    season_id = -1
                query = query.join(Colecciones, Colecciones.idColeccion == Producto.idColeccion).where(
                    Colecciones.idEmpresa == tenant_id, Colecciones.idTemporada == season_id)
            elif promotion.alcance == "tipo":
                query = query.where(func.lower(Producto.tipo) == (promotion.alcance_ref or "").lower())
            products = sorted((await session.execute(query)).scalars().all())
        row = {key: value for key, value in promotion.__dict__.items() if not key.startswith("_")}
        row["productos"] = products
        serialized.append(row)
    return serialized


@router.get("/api/promotions", dependencies=[Depends(require_feature("promociones"))])
async def list_promotions(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Promocion).where(Promocion.idEmpresa == _tenant(auth)).order_by(Promocion.idPromocion)
    )
    return result.scalars().all()


@router.post("/api/promotions", status_code=201, dependencies=[Depends(require_feature("promociones"))])
async def create_promotion(
    payload: PromocionIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    promotion = Promocion(idEmpresa=_tenant(auth), **payload.model_dump())
    session.add(promotion)
    await session.commit()
    await session.refresh(promotion)
    return promotion


@router.put("/api/promotions/{promotion_id}", dependencies=[Depends(require_feature("promociones"))])
async def update_promotion(
    promotion_id: int,
    payload: PromocionIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Promocion).where(
            Promocion.idPromocion == promotion_id,
            Promocion.idEmpresa == _tenant(auth),
        ).with_for_update()
    )
    promotion = result.scalar_one_or_none()
    if promotion is None:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    for key, value in payload.model_dump().items():
        setattr(promotion, key, value)
    await session.commit()
    await session.refresh(promotion)
    return promotion


@router.delete("/api/promotions/{promotion_id}", dependencies=[Depends(require_feature("promociones"))])
async def deactivate_promotion(
    promotion_id: int,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Promocion).where(
            Promocion.idPromocion == promotion_id,
            Promocion.idEmpresa == _tenant(auth),
        ).with_for_update()
    )
    promotion = result.scalar_one_or_none()
    if promotion is None:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    promotion.activa = False
    await session.commit()
    return {"ok": True}


@router.get("/api/coupons", dependencies=[Depends(require_feature("promociones"))])
async def list_coupons(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Cupon).where(Cupon.idEmpresa == _tenant(auth)).order_by(Cupon.idCupon)
    )
    return result.scalars().all()


@router.post("/api/coupons", status_code=201, dependencies=[Depends(require_feature("promociones"))])
async def create_coupon(
    payload: CuponIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    if payload.idCliente is not None:
        customer = (await session.execute(select(Cliente).where(
            Cliente.idCliente == payload.idCliente, Cliente.idEmpresa == _tenant(auth)
        ))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=400, detail="Cliente inexistente")
    duplicate = (await session.execute(select(Cupon.idCupon).where(
        Cupon.idEmpresa == _tenant(auth), Cupon.codigo == payload.codigo
    ))).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Ya existe un cupón con ese código")
    coupon = Cupon(idEmpresa=_tenant(auth), **payload.model_dump())
    session.add(coupon)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        duplicate = (await session.execute(select(Cupon.idCupon).where(
            Cupon.idEmpresa == _tenant(auth), Cupon.codigo == coupon.codigo
        ))).scalar_one_or_none()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Ya existe un cupón con ese código")
        raise
    await session.refresh(coupon)
    return coupon


@router.put("/api/coupons/{coupon_id}", dependencies=[Depends(require_feature("promociones"))])
async def update_coupon(
    coupon_id: int,
    payload: CuponIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Cupon).where(
            Cupon.idCupon == coupon_id,
            Cupon.idEmpresa == _tenant(auth),
        ).with_for_update()
    )
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    if payload.idCliente is not None:
        customer = (await session.execute(select(Cliente).where(
            Cliente.idCliente == payload.idCliente, Cliente.idEmpresa == _tenant(auth)
        ))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=400, detail="Cliente inexistente")
    for key, value in payload.model_dump().items():
        setattr(coupon, key, value)
    await session.commit()
    await session.refresh(coupon)
    return coupon


@router.delete("/api/coupons/{coupon_id}", dependencies=[Depends(require_feature("promociones"))])
async def deactivate_coupon(
    coupon_id: int,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("promocion.gestionar")),
):
    result = await session.execute(
        select(Cupon).where(
            Cupon.idCupon == coupon_id,
            Cupon.idEmpresa == _tenant(auth),
        ).with_for_update()
    )
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    coupon.activo = False
    await session.commit()
    return {"ok": True}
