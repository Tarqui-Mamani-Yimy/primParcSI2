from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select

from app.database import get_tenant_db
from app.models import (Bitacora, Cliente, DetalleVenta, Historial, Inventario, MetodoPago,
                        Movimiento, OperacionIdempotente, Producto, Reserva, Sucursal,
                        SyncBorrado, Venta)
from app.security import get_current_payload, require_feature, require_permiso
from app.schemas.fase2 import OfflineSaleIn
from app.services.idempotency import replay_if_present, save_result

router = APIRouter(prefix="/api/sync", tags=["sync"])
SYNC_MODELS = {"productos": Producto, "sucursales": Sucursal, "inventario": Inventario,
               "reservas": Reserva, "ventas": Venta, "cliente": Cliente}


def _row_dict(row):
    return {column.key: getattr(row, column.key) for column in row.__table__.columns}


@router.get("/pull")
async def pull(since: datetime | None = Query(default=None), session=Depends(get_tenant_db),
               auth: dict = Depends(get_current_payload)):
    permissions = set(auth.get("permisos", []))
    if since is not None and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    is_customer = auth.get("rol") == "Cliente"
    full = since is None or since < datetime.now(timezone.utc) - timedelta(days=30)
    result = {"serverTime": datetime.now(timezone.utc), "full": full,
              "productos": [], "sucursales": [], "inventario": [], "reservas": [],
              "ventas": [], "cliente": None,
              "deleted": {"productos": [], "inventario": [], "reservas": []}}
    own_customer = None
    if is_customer:
        own_customer = (await session.execute(select(Cliente).where(Cliente.idUser == int(auth["sub"])))).scalar_one_or_none()
        if own_customer is not None and (full or own_customer.fechaActualizacion > since):
            result["cliente"] = _row_dict(own_customer)
    visible = {"productos"}
    if is_customer or "inventario.ver" in permissions:
        visible.add("sucursales")
        visible.add("inventario")
    if "reserva.gestionar" in permissions:
        visible.add("reservas")
    elif own_customer:
        stmt = select(Reserva).where(Reserva.idCliente == own_customer.idCliente)
        if not full:
            stmt = stmt.where(Reserva.fechaActualizacion > since)
        result["reservas"] = [_row_dict(r) for r in (await session.execute(stmt)).scalars().all()]
    if "venta.ver" in permissions:
        visible.add("ventas")
    elif own_customer:
        stmt = select(Venta).where(Venta.idCliente == own_customer.idCliente)
        if not full:
            stmt = stmt.where(Venta.fechaActualizacion > since)
        result["ventas"] = [_row_dict(v) for v in (await session.execute(stmt)).scalars().all()]
    for name in visible:
        model = SYNC_MODELS[name]
        stmt = select(model)
        if not full and hasattr(model, "fechaActualizacion"):
            stmt = stmt.where(model.fechaActualizacion > since)
        result[name] = [_row_dict(row) for row in (await session.execute(stmt)).scalars().all()]
    # Deletes are intentionally limited to the requested delta window.
    if not full and since is not None:
        stmt = select(SyncBorrado).where(SyncBorrado.borradoEn > since)
        if "inventario.ver" not in permissions:
            stmt = stmt.where(SyncBorrado.tabla != "Inventario")
        if "reserva.gestionar" not in permissions:
            if own_customer is None:
                stmt = stmt.where(SyncBorrado.tabla != "Reserva")
            else:
                stmt = stmt.where((SyncBorrado.tabla != "Reserva") |
                                  (SyncBorrado.idCliente == own_customer.idCliente))
        rows = (await session.execute(stmt)).scalars().all()
        table_map = {"producto": "productos", "Inventario": "inventario", "Reserva": "reservas"}
        for row in rows:
            target = table_map.get(row.tabla)
            if target:
                result["deleted"][target].append(row.idRegistro)
    return result


@router.post("/sales", status_code=201, dependencies=[Depends(require_permiso("venta.crear")),
                                                     Depends(require_feature("pos"))])
async def sync_sale(payload: OfflineSaleIn, request: Request, response: Response,
                    session=Depends(get_tenant_db), auth: dict = Depends(get_current_payload)):
    if not request.headers.get("Idempotency-Key"):
        raise HTTPException(status_code=422, detail={"code": "idempotency_key_required"})
    pending = await replay_if_present(request, session, auth, response, payload.model_dump(mode="json"))
    if pending is not None and not isinstance(pending, tuple):
        return pending
    if payload.pago.tipo != "Efectivo":
        raise HTTPException(status_code=422, detail={"code": "offline_payment_not_allowed"})
    if not payload.items:
        raise HTTPException(status_code=422, detail={"code": "sale_items_required"})
    if payload.pago.monto < 0:
        raise HTTPException(status_code=422, detail={"code": "invalid_payment_amount"})
    if payload.idCliente is None:
        # No canonical generic walk-in customer marker exists in the current model.
        raise HTTPException(status_code=422, detail={"code": "walk_in_customer_unavailable"})
    if "venta.ver" not in auth.get("permisos", []):
        own_customer = (await session.execute(select(Cliente).where(
            Cliente.idUser == int(auth["sub"])
        ))).scalar_one_or_none()
        if own_customer is None:
            raise HTTPException(status_code=403, detail="La cuenta no tiene un cliente asociado")
        if payload.idCliente != own_customer.idCliente:
            raise HTTPException(status_code=403, detail="No puede registrar una venta para otro cliente")
    customer = await session.get(Cliente, payload.idCliente)
    if customer is None:
        raise HTTPException(status_code=422, detail={"code": "customer_not_found"})
    method = MetodoPago(tipo="Efectivo", estado="Activo", fecha=datetime.now(timezone.utc),
                       monto=payload.pago.monto, origen="offline", idUserPago=int(auth["sub"]),
                       consumidoEn=datetime.now(timezone.utc))
    session.add(method)
    await session.flush()
    sale = Venta(idCliente=customer.idCliente, idMetPago=method.idMetPago, total=0,
                 fecha=payload.fechaLocal,
                 origen="offline", comprobanteLocal=payload.comprobanteLocal,
                 discrepanciaStock=False)
    session.add(sale)
    await session.flush()
    total = 0.0
    sale_details = []
    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=422, detail={"code": "invalid_quantity"})
        product = await session.get(Producto, item.idProducto)
        if product is None:
            raise HTTPException(status_code=422, detail={"code": "product_not_found", "idProducto": item.idProducto})
        inv = (await session.execute(select(Inventario).where(
            Inventario.codigoSucursal == payload.codigoSucursal,
            Inventario.idProducto == item.idProducto,
        ))).scalar_one_or_none()
        if inv is None:
            raise HTTPException(status_code=422, detail={"code": "inventory_not_found", "idProducto": item.idProducto})
        if inv.cantidad_actual - inv.cantidad_reservada < item.cantidad:
            sale.discrepanciaStock = True
        inv.cantidad_actual -= item.cantidad
        total += float(product.venta) * item.cantidad
        detail = DetalleVenta(cantidad=item.cantidad, precio_unitario=product.venta,
                              idProducto=product.idProducto, idVenta=sale.idVenta)
        sale_details.append((detail, product.nombre))
        session.add(detail)
        session.add(Movimiento(tipo="venta", cantidad=-item.cantidad,
                               motivo=f"Offline sale {sale.idVenta}", idInv=inv.idInv))
        session.add(Historial(idProducto=product.idProducto, idCliente=customer.idCliente,
                              idVenta=sale.idVenta))
    sale.total = total
    if round(payload.pago.monto, 2) != round(total, 2):
        raise HTTPException(status_code=422, detail={"code": "offline_payment_amount_mismatch"})
    await session.flush()
    detail_results = [{"codigoVenta": detail.codigoVenta, "cantidad": detail.cantidad,
                       "precio_unitario": float(detail.precio_unitario),
                       "idProducto": detail.idProducto, "producto_nombre": product_name,
                       "idVenta": detail.idVenta} for detail, product_name in sale_details]
    result = {"idVenta": sale.idVenta, "fecha": sale.fecha.isoformat(), "total": total,
              "idCliente": sale.idCliente, "idMetPago": method.idMetPago, "detalles": detail_results,
              "origen": "offline", "comprobanteLocal": payload.comprobanteLocal,
              "discrepanciaStock": sale.discrepanciaStock,
              "discrepanciaResueltaEn": None, "discrepanciaNota": None}
    await save_result(session, pending, auth, request, 201, result)
    await session.commit()
    response.status_code = 201
    return result
