from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Ciudad, Inventario, Movimiento, Producto, Sucursal
from app.schemas.inventory import (
    LocationOut,
    StockAdjustIn,
    StockOut,
)
from app.security import get_current_payload, require_permiso

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/locations", response_model=list[LocationOut])
async def list_locations(session: AsyncSession = Depends(get_db)):
    stmt = (
        select(Sucursal, Ciudad)
        .join(Ciudad, Ciudad.idCiudad == Sucursal.idCiudad)
        .order_by(Sucursal.nombre)
    )
    rows = (await session.execute(stmt)).all()
    return [LocationOut.from_row(s, c.nombCiudad) for s, c in rows]


@router.get("/stock", response_model=list[StockOut])
async def list_stock(
    codigoSucursal: int | None = None,
    idProducto: int | None = None,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("inventario.ver")),
):
    stmt = (
        select(Inventario, Sucursal, Producto)
        .join(Sucursal, Sucursal.codigoSucursal == Inventario.codigoSucursal)
        .join(Producto, Producto.idProducto == Inventario.idProducto)
    )
    if codigoSucursal is not None:
        stmt = stmt.where(Inventario.codigoSucursal == codigoSucursal)
    if idProducto is not None:
        stmt = stmt.where(Inventario.idProducto == idProducto)

    rows = (await session.execute(stmt)).all()
    result = []
    for inv, suc, prod in rows:
        result.append(
            StockOut(
                idInv=inv.idInv,
                cantidad_actual=inv.cantidad_actual,
                cantidad_reservada=inv.cantidad_reservada,
                codigoSucursal=inv.codigoSucursal,
                sucursal_nombre=suc.nombre,
                idProducto=inv.idProducto,
                producto_nombre=prod.nombre,
                producto_tipo=prod.tipo,
                producto_talla=prod.talla,
                producto_color=prod.color,
                producto_imagen=prod.imagen_url,
            )
        )
    return result


@router.patch("/stock/{idInv}/adjust", response_model=StockOut)
async def adjust_stock(
    idInv: int,
    payload: StockAdjustIn,
    session: AsyncSession = Depends(get_db),
    _=Depends(get_current_payload),
):
    inv = await session.get(Inventario, idInv)
    if not inv:
        raise HTTPException(status_code=404, detail="Registro de inventario no encontrado")

    cantidad = payload.cantidad
    if cantidad < 0:
        raise HTTPException(status_code=400, detail="cantidad debe ser >= 0")
    if payload.signo == "set":
        nuevo = cantidad
    elif payload.signo == "add":
        nuevo = inv.cantidad_actual + cantidad
    elif payload.signo == "subtract":
        nuevo = inv.cantidad_actual - cantidad
    else:
        raise HTTPException(status_code=400, detail="signo invalido")

    if nuevo < 0:
        raise HTTPException(status_code=400, detail="La cantidad resultante no puede ser negativa")

    inv.cantidad_actual = nuevo
    movimiento = Movimiento(
        tipo=payload.tipo,
        cantidad=cantidad,
        motivo=payload.motivo,
        idInv=inv.idInv,
    )
    session.add(movimiento)
    await session.commit()
    await session.refresh(inv)

    suc = await session.get(Sucursal, inv.codigoSucursal)
    prod = await session.get(Producto, inv.idProducto)
    return StockOut(
        idInv=inv.idInv,
        cantidad_actual=inv.cantidad_actual,
        cantidad_reservada=inv.cantidad_reservada,
        codigoSucursal=inv.codigoSucursal,
        sucursal_nombre=suc.nombre if suc else None,
        idProducto=inv.idProducto,
        producto_nombre=prod.nombre if prod else None,
        producto_tipo=prod.tipo if prod else None,
        producto_talla=prod.talla if prod else None,
        producto_color=prod.color if prod else None,
        producto_imagen=prod.imagen_url if prod else None,
    )
