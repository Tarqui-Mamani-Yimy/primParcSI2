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
    Reserva,
    Sucursal,
    Venta,
)
from app.schemas.fase2 import (
    ReservaConfirmarIn,
    ReservaIn,
    ReservaOut,
    VentaOut,
)
from app.security import get_current_payload, require_permiso

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


def _parse_hora(valor) -> time:
    if isinstance(valor, time):
        return valor
    if isinstance(valor, str):
        return time.fromisoformat(valor)
    raise HTTPException(status_code=400, detail="horario invalido")


async def _serialize_reserva(r: Reserva, session: AsyncSession) -> ReservaOut:
    p = await session.get(Producto, r.idProducto)
    s = await session.get(Sucursal, r.codigoSucursal)
    return ReservaOut(
        codigoReserva=r.codigoReserva,
        fecha=r.fecha,
        horario=r.horario.isoformat(),
        estado=r.estado,
        idCliente=r.idCliente,
        codigoSucursal=r.codigoSucursal,
        idProducto=r.idProducto,
        producto_nombre=p.nombre if p else None,
        sucursal_nombre=s.nombre if s else None,
    )


async def _registrar_bitacora(session: AsyncSession, accion: str, idUser: int, ip: str):
    now = datetime.now()
    b = Bitacora(accion=accion, hora=now.time(), fecha=now.date(), ip=ip, idUser=idUser)
    session.add(b)


@router.get("", response_model=list[ReservaOut])
async def list_reservations(
    idCliente: int | None = None,
    estado: str | None = None,
    session: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_payload),
):
    permisos = payload.get("permisos", [])
    stmt = select(Reserva).order_by(Reserva.fecha.desc())
    if estado is not None:
        stmt = stmt.where(Reserva.estado == estado)
    if "reserva.gestionar" in permisos:
        if idCliente is not None:
            stmt = stmt.where(Reserva.idCliente == idCliente)
    else:
        user_id = int(payload["sub"])
        cliente = (
            await session.execute(select(Cliente).where(Cliente.idUser == user_id))
        ).scalar_one_or_none()
        if cliente is None:
            return []
        stmt = stmt.where(Reserva.idCliente == cliente.idCliente)
    reservas = (await session.execute(stmt)).scalars().all()
    return [await _serialize_reserva(r, session) for r in reservas]


@router.post("", response_model=ReservaOut, status_code=201)
async def create_reservation(
    payload: ReservaIn,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("reserva.crear")),
):
    if not await session.get(Cliente, payload.idCliente):
        raise HTTPException(status_code=400, detail="Cliente inexistente")
    if not await session.get(Sucursal, payload.codigoSucursal):
        raise HTTPException(status_code=400, detail="Sucursal inexistente")
    if not await session.get(Producto, payload.idProducto):
        raise HTTPException(status_code=400, detail="Producto inexistente")

    inv = (
        await session.execute(
            select(Inventario).where(
                Inventario.codigoSucursal == payload.codigoSucursal,
                Inventario.idProducto == payload.idProducto,
            )
        )
    ).scalar_one_or_none()
    if inv is None or inv.cantidad_actual - inv.cantidad_reservada <= 0:
        raise HTTPException(status_code=400, detail="No hay stock disponible para reservar")

    inv.cantidad_reservada += 1

    reserva = Reserva(
        fecha=payload.fecha,
        horario=_parse_hora(payload.horario),
        estado="Pendiente",
        idCliente=payload.idCliente,
        codigoSucursal=payload.codigoSucursal,
        idProducto=payload.idProducto,
    )
    session.add(reserva)
    await session.commit()
    await session.refresh(reserva)
    return await _serialize_reserva(reserva, session)


@router.put("/{codigoReserva}/confirm", response_model=VentaOut)
async def confirm_reservation(
    codigoReserva: int,
    payload: ReservaConfirmarIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_permiso("reserva.gestionar")),
):
    reserva = await session.get(Reserva, codigoReserva)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != "Pendiente":
        raise HTTPException(status_code=400, detail=f"Reserva en estado {reserva.estado}, no se puede confirmar")
    if not await session.get(MetodoPago, payload.idMetPago):
        raise HTTPException(status_code=400, detail="Metodo de pago inexistente")

    inv = (
        await session.execute(
            select(Inventario).where(
                Inventario.codigoSucursal == reserva.codigoSucursal,
                Inventario.idProducto == reserva.idProducto,
            )
        )
    ).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=400, detail="Inventario no encontrado para la reserva")
    if inv.cantidad_reservada <= 0:
        raise HTTPException(status_code=400, detail="La reserva no tiene stock reservado")

    producto = await session.get(Producto, reserva.idProducto)

    inv.cantidad_reservada -= 1
    inv.cantidad_actual -= 1

    venta = Venta(total=float(producto.venta), idCliente=reserva.idCliente, idMetPago=payload.idMetPago)
    session.add(venta)
    await session.flush()

    detalle = DetalleVenta(
        cantidad=1,
        precio_unitario=float(producto.venta),
        idProducto=reserva.idProducto,
        idVenta=venta.idVenta,
        codigoReserva=codigoReserva,
    )
    session.add(detalle)

    session.add(
        Movimiento(
            tipo="venta_reserva",
            cantidad=-1,
            motivo=f"Confirmacion reserva {codigoReserva}",
            idInv=inv.idInv,
        )
    )
    session.add(
        Historial(
            idProducto=reserva.idProducto,
            idCliente=reserva.idCliente,
            idVenta=venta.idVenta,
        )
    )

    reserva.estado = "Confirmada"
    await _registrar_bitacora(session, f"Reserva {codigoReserva} confirmada", int(auth["sub"]), request.client.host if request.client else "0.0.0.0")
    await session.commit()
    await session.refresh(venta)
    return VentaOut(
        idVenta=venta.idVenta,
        fecha=venta.fecha,
        total=float(venta.total),
        idCliente=venta.idCliente,
        idMetPago=venta.idMetPago,
        detalles=[],
    )


@router.put("/{codigoReserva}/cancel", response_model=ReservaOut)
async def cancel_reservation(
    codigoReserva: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("reserva.gestionar")),
):
    reserva = await session.get(Reserva, codigoReserva)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar reservas pendientes")

    inv = (
        await session.execute(
            select(Inventario).where(
                Inventario.codigoSucursal == reserva.codigoSucursal,
                Inventario.idProducto == reserva.idProducto,
            )
        )
    ).scalar_one_or_none()
    if inv and inv.cantidad_reservada > 0:
        inv.cantidad_reservada -= 1

    reserva.estado = "Cancelada"
    await session.commit()
    await session.refresh(reserva)
    return await _serialize_reserva(reserva, session)
