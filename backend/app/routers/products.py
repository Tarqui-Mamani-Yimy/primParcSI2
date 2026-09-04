from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Colecciones, Producto, Proveedor, Temporada
from app.schemas.products import (
    PaginatedProductos,
    ProductoIn,
    ProductoOut,
    ProductoUpdate,
)
from app.security import get_current_payload

router = APIRouter(prefix="/api/products", tags=["products"])


async def _serialize(producto: Producto, session: AsyncSession) -> ProductoOut:
    proveedor = await session.get(Proveedor, producto.idProveedor)
    coleccion = await session.get(Colecciones, producto.idColeccion)
    return ProductoOut(
        idProducto=producto.idProducto,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        costo=float(producto.costo),
        venta=float(producto.venta),
        tipo=producto.tipo,
        talla=producto.talla,
        color=producto.color,
        idProveedor=producto.idProveedor,
        idColeccion=producto.idColeccion,
        proveedor_nombre=proveedor.nombre if proveedor else None,
        coleccion_nombre=coleccion.nombre_coleccion if coleccion else None,
        imagen_url=producto.imagen_url,
        imagenes_secundarias=producto.imagenes_secundarias or [],
    )


@router.get("", response_model=PaginatedProductos)
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    tipo: str | None = None,
    talla: str | None = None,
    color: str | None = None,
    idColeccion: int | None = None,
    idProveedor: int | None = None,
    query: str | None = Query(None, alias="q"),
    session: AsyncSession = Depends(get_db),
):
    filters = []
    if tipo:
        filters.append(Producto.tipo.ilike(f"%{tipo}%"))
    if talla:
        filters.append(Producto.talla == talla)
    if color:
        filters.append(Producto.color.ilike(f"%{color}%"))
    if idColeccion is not None:
        filters.append(Producto.idColeccion == idColeccion)
    if idProveedor is not None:
        filters.append(Producto.idProveedor == idProveedor)
    if query:
        filters.append(Producto.nombre.ilike(f"%{query}%"))

    total = (
        await session.execute(select(func.count(Producto.idProducto)).where(*filters))
    ).scalar_one()

    stmt = (
        select(Producto)
        .where(*filters)
        .order_by(Producto.idProducto.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await session.execute(stmt)).scalars().all()

    items = [await _serialize(p, session) for p in rows]
    return PaginatedProductos(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=ceil(total / size) if total else 0,
    )


@router.get("/{idProducto}", response_model=ProductoOut)
async def get_product(idProducto: int, session: AsyncSession = Depends(get_db)):
    producto = await session.get(Producto, idProducto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return await _serialize(producto, session)


@router.post("", response_model=ProductoOut, status_code=201)
async def create_product(
    payload: ProductoIn,
    session: AsyncSession = Depends(get_db),
    _=Depends(get_current_payload),
):
    if not await session.get(Proveedor, payload.idProveedor):
        raise HTTPException(status_code=400, detail="Proveedor inexistente")
    if not await session.get(Colecciones, payload.idColeccion):
        raise HTTPException(status_code=400, detail="Coleccion inexistente")

    producto = Producto(**payload.model_dump())
    session.add(producto)
    await session.commit()
    await session.refresh(producto)
    return await _serialize(producto, session)


@router.put("/{idProducto}", response_model=ProductoOut)
async def update_product(
    idProducto: int,
    payload: ProductoUpdate,
    session: AsyncSession = Depends(get_db),
    _=Depends(get_current_payload),
):
    producto = await session.get(Producto, idProducto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "idProveedor" in data and not await session.get(Proveedor, data["idProveedor"]):
        raise HTTPException(status_code=400, detail="Proveedor inexistente")
    if "idColeccion" in data and not await session.get(Colecciones, data["idColeccion"]):
        raise HTTPException(status_code=400, detail="Coleccion inexistente")

    for key, value in data.items():
        setattr(producto, key, value)

    await session.commit()
    await session.refresh(producto)
    return await _serialize(producto, session)


@router.delete("/{idProducto}", status_code=204)
async def delete_product(
    idProducto: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(get_current_payload),
):
    producto = await session.get(Producto, idProducto)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    await session.delete(producto)
    await session.commit()
