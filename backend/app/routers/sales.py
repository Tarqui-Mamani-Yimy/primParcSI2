from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Bitacora,
    Cliente,
    DetalleVenta,
    Historial,
    Inventario,
    MetodoPago,
    Movimiento,
    Producto,
    Venta,
)
from app.schemas.fase2 import DetalleVentaOut, VentaIn, VentaOut
from app.security import get_current_payload, require_permiso

router = APIRouter(prefix="/api/sales", tags=["sales"])


async def _registrar_bitacora(session: AsyncSession, accion: str, idUser: int, ip: str):
    now = datetime.now()
    b = Bitacora(
        accion=accion,
        hora=now.time(),
        fecha=now.date(),
        ip=ip,
        idUser=idUser,
    )
    session.add(b)


async def _serialize_detalle(d: DetalleVenta, session: AsyncSession) -> DetalleVentaOut:
    p = await session.get(Producto, d.idProducto)
    return DetalleVentaOut(
        codigoVenta=d.codigoVenta,
        cantidad=d.cantidad,
        precio_unitario=float(d.precio_unitario),
        idProducto=d.idProducto,
        producto_nombre=p.nombre if p else None,
        idVenta=d.idVenta,
    )


async def _serialize_venta(v: Venta, session: AsyncSession, detalles: list[DetalleVenta]) -> VentaOut:
    return VentaOut(
        idVenta=v.idVenta,
        fecha=v.fecha,
        total=float(v.total),
        idCliente=v.idCliente,
        idMetPago=v.idMetPago,
        detalles=[await _serialize_detalle(d, session) for d in detalles],
    )


@router.get("", response_model=list[VentaOut])
async def list_sales(
    idCliente: int | None = None,
    session: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_payload),
):
    permisos = payload.get("permisos", [])

    if "venta.ver" in permisos:
        stmt = select(Venta).order_by(Venta.fecha.desc())
        if idCliente is not None:
            stmt = stmt.where(Venta.idCliente == idCliente)
        ventas = (await session.execute(stmt)).scalars().all()
    else:
        if idCliente is not None and "cliente.ver" not in permisos:
            raise HTTPException(status_code=403, detail="No autorizado")
        user_id = int(payload["sub"])
        cliente = (
            await session.execute(select(Cliente).where(Cliente.idUser == user_id))
        ).scalar_one_or_none()
        if cliente is None:
            return []
        ventas = (
            await session.execute(
                select(Venta).where(Venta.idCliente == cliente.idCliente).order_by(Venta.fecha.desc())
            )
        ).scalars().all()

    resultado = []
    for v in ventas:
        detalles = (
            await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == v.idVenta))
        ).scalars().all()
        resultado.append(await _serialize_venta(v, session, detalles))
    return resultado


@router.get("/{idVenta}", response_model=VentaOut)
async def get_sale(idVenta: int, session: AsyncSession = Depends(get_db),
                   _=Depends(require_permiso("venta.ver"))):
    v = await session.get(Venta, idVenta)
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    detalles = (
        await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == idVenta))
    ).scalars().all()
    return await _serialize_venta(v, session, detalles)


@router.post("", response_model=VentaOut, status_code=201)
async def create_sale(
    payload: VentaIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_permiso("venta.crear")),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un item")
    if not await session.get(Cliente, payload.idCliente):
        raise HTTPException(status_code=400, detail="Cliente inexistente")
    if not await session.get(MetodoPago, payload.idMetPago):
        raise HTTPException(status_code=400, detail="Metodo de pago inexistente")

    total = 0.0
    venta = Venta(total=0.0, idCliente=payload.idCliente, idMetPago=payload.idMetPago)
    session.add(venta)
    await session.flush()

    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="cantidad debe ser > 0")
        producto = await session.get(Producto, item.idProducto)
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto {item.idProducto} inexistente")

        inv = (
            await session.execute(
                select(Inventario).where(
                    Inventario.idProducto == item.idProducto,
                    Inventario.cantidad_reservada < Inventario.cantidad_actual,
                ).order_by(Inventario.idInv)
            )
        ).scalars().first()
        if inv is None:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente del producto {item.idProducto} en todas las sucursales",
            )

        if inv.cantidad_actual - inv.cantidad_reservada < item.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock disponible insuficiente del producto {item.idProducto}",
            )

        precio_unitario = float(producto.venta)
        inv.cantidad_actual -= item.cantidad
        total += precio_unitario * item.cantidad

        detalle = DetalleVenta(
            cantidad=item.cantidad,
            precio_unitario=precio_unitario,
            idProducto=item.idProducto,
            idVenta=venta.idVenta,
        )
        session.add(detalle)

        session.add(
            Movimiento(
                tipo="venta",
                cantidad=-item.cantidad,
                motivo=f"Venta {venta.idVenta}",
                idInv=inv.idInv,
            )
        )

        session.add(
            Historial(
                idProducto=item.idProducto,
                idCliente=payload.idCliente,
                idVenta=venta.idVenta,
            )
        )
        await session.flush()

    venta.total = total
    await _registrar_bitacora(session, f"Venta {venta.idVenta} creada", int(auth["sub"]), request.client.host if request.client else "0.0.0.0")
    await session.commit()
    await session.refresh(venta)

    detalles = (
        await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == venta.idVenta))
    ).scalars().all()
    return await _serialize_venta(venta, session, detalles)
