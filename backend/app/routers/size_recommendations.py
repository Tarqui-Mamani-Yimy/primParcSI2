from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.models import (
    Cliente,
    DetalleVenta,
    Producto,
    RetroalimentacionAjuste,
    Venta,
)
from app.schemas.size_recommendation import (
    FitFeedbackIn,
    FitFeedbackMineOut,
    FitFeedbackSavedOut,
    FitFeedbackSummaryOut,
    SizeRecommendationOut,
)
from app.security import get_current_payload, get_tenant, require_permiso
from app.services.size_recommendation import (
    feedback_note,
    get_feedback_counts,
    recommend_size,
)

router = APIRouter(tags=["size-recommendations", "fit-feedback"])


async def _require_client(session: AsyncSession, payload: dict, tenant_id: int) -> Cliente:
    if payload.get("rol") != "Cliente":
        raise HTTPException(status_code=403, detail="Esta función es exclusiva para clientes")
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Token de cliente inválido")
    client = (await session.execute(
        select(Cliente).where(Cliente.idUser == user_id, Cliente.idEmpresa == tenant_id)
    )).scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=403, detail="La cuenta no tiene un cliente asociado")
    return client


async def _tenant_product(session: AsyncSession, idProducto: int, tenant_id: int) -> Producto:
    product = (await session.execute(
        select(Producto).where(Producto.idProducto == idProducto, Producto.idEmpresa == tenant_id)
    )).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.get(
    "/api/products/{idProducto}/size-recommendation",
    response_model=SizeRecommendationOut,
)
async def get_size_recommendation(
    idProducto: int,
    session: AsyncSession = Depends(get_tenant_db),
    payload: dict = Depends(get_current_payload),
    tenant_id: int = Depends(get_tenant),
):
    client = await _require_client(session, payload, tenant_id)
    await _tenant_product(session, idProducto, tenant_id)
    return await recommend_size(
        session,
        idProducto,
        tenant_id,
        {"pecho": client.pecho, "cintura": client.cintura},
    )


@router.post(
    "/api/products/{idProducto}/fit-feedback",
    response_model=FitFeedbackSavedOut,
)
async def save_fit_feedback(
    idProducto: int,
    payload: FitFeedbackIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(get_current_payload),
    tenant_id: int = Depends(get_tenant),
):
    client = await _require_client(session, auth, tenant_id)
    product = await _tenant_product(session, idProducto, tenant_id)
    # Venta rows are created only after a checkout sale succeeds and commits;
    # the current schema has no separate sale-status column.
    purchased = (await session.execute(
        select(DetalleVenta.codigoVenta)
        .join(Venta, and_(
            Venta.idVenta == DetalleVenta.idVenta,
            Venta.idEmpresa == tenant_id,
        ))
        .where(
            DetalleVenta.idEmpresa == tenant_id,
            DetalleVenta.idProducto == idProducto,
            Venta.idCliente == client.idCliente,
        )
        .limit(1)
    )).scalar_one_or_none()
    if purchased is None:
        raise HTTPException(status_code=403, detail="Solo puedes opinar sobre productos que compraste")

    # Lock the owning client row so simultaneous submissions for this client
    # serialize before checking the unique client/product feedback row.
    await session.execute(
        select(Cliente.idCliente).where(
            Cliente.idCliente == client.idCliente,
            Cliente.idEmpresa == tenant_id,
        ).with_for_update()
    )
    feedback = (await session.execute(
        select(RetroalimentacionAjuste).where(
            RetroalimentacionAjuste.idEmpresa == tenant_id,
            RetroalimentacionAjuste.idCliente == client.idCliente,
            RetroalimentacionAjuste.idProducto == idProducto,
        ).with_for_update()
    )).scalar_one_or_none()
    saved_at = datetime.now(timezone.utc)
    if feedback is None:
        feedback = RetroalimentacionAjuste(
            idEmpresa=tenant_id,
            idCliente=client.idCliente,
            idProducto=idProducto,
            talla=product.talla or "",
            resultado=payload.resultado,
            comentario=payload.comentario,
            fecha=saved_at,
        )
        session.add(feedback)
    else:
        feedback.talla = product.talla or ""
        feedback.resultado = payload.resultado
        feedback.comentario = payload.comentario
        feedback.fecha = saved_at
    await session.commit()
    return FitFeedbackSavedOut(
        idProducto=idProducto,
        talla=feedback.talla,
        resultado=feedback.resultado,
        comentario=feedback.comentario,
        fecha=feedback.fecha,
    )


@router.get("/api/fit-feedback/mine", response_model=list[FitFeedbackMineOut])
async def list_my_fit_feedback(
    session: AsyncSession = Depends(get_tenant_db),
    payload: dict = Depends(get_current_payload),
    tenant_id: int = Depends(get_tenant),
):
    client = await _require_client(session, payload, tenant_id)
    rows = (await session.execute(
        select(Producto, RetroalimentacionAjuste)
        .join(DetalleVenta, and_(
            DetalleVenta.idProducto == Producto.idProducto,
            DetalleVenta.idEmpresa == tenant_id,
        ))
        .join(Venta, and_(
            Venta.idVenta == DetalleVenta.idVenta,
            Venta.idEmpresa == tenant_id,
        ))
        .outerjoin(RetroalimentacionAjuste, and_(
            RetroalimentacionAjuste.idProducto == Producto.idProducto,
            RetroalimentacionAjuste.idCliente == client.idCliente,
            RetroalimentacionAjuste.idEmpresa == tenant_id,
        ))
        .where(
            Producto.idEmpresa == tenant_id,
            Venta.idCliente == client.idCliente,
        )
        .distinct()
        .order_by(Producto.nombre, Producto.idProducto)
    )).all()
    return [FitFeedbackMineOut(
        idProducto=product.idProducto,
        nombre=product.nombre,
        talla=feedback.talla if feedback else (product.talla or ""),
        imagen_url=product.imagen_url,
        resultado=feedback.resultado if feedback else None,
        fecha=feedback.fecha if feedback else None,
    ) for product, feedback in rows]


@router.get(
    "/api/fit-feedback/summary",
    response_model=list[FitFeedbackSummaryOut],
)
async def summarize_fit_feedback(
    session: AsyncSession = Depends(get_tenant_db),
    tenant_id: int = Depends(get_tenant),
    _=Depends(require_permiso("producto.editar")),
):
    products = (await session.execute(
        select(Producto).where(Producto.idEmpresa == tenant_id)
    )).scalars().all()
    summaries = []
    for product in products:
        counts = await get_feedback_counts(session, product.idProducto, tenant_id)
        summaries.append(FitFeedbackSummaryOut(
            idProducto=product.idProducto,
            nombre=product.nombre,
            talla=product.talla,
            total=counts["total"],
            pequena=counts["pequena"],
            bien=counts["bien"],
            grande=counts["grande"],
            alerta=feedback_note(counts) is not None,
        ))
    summaries.sort(key=lambda item: (not item.alerta, -item.total, item.nombre, item.idProducto))
    return summaries
