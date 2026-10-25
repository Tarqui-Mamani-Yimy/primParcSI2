from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ValidationError
from sqlalchemy import select

from app.database import get_tenant_db
from app.models import (Bitacora, Cliente, DetalleVenta, Historial, Inventario, MetodoPago,
                        Movimiento, OperacionIdempotente, Plan, Producto, Reserva, Sucursal,
                        Suscripcion, SyncBorrado, Venta)
from app.security import get_current_payload, require_feature, require_permiso
from app.schemas.fase2 import OfflineSaleIn
from app.services.idempotency import body_hash, replay_if_present, save_result

router = APIRouter(prefix="/api/sync", tags=["sync"])
SYNC_MODELS = {"productos": Producto, "sucursales": Sucursal, "inventario": Inventario,
               "reservas": Reserva, "ventas": Venta, "cliente": Cliente}


class SyncPushOperation(BaseModel):
    idLocal: UUID
    tipo: Literal["venta", "reserva"]
    payload: dict[str, Any]


class SyncPushBatch(BaseModel):
    operations: list[SyncPushOperation]


class OfflineReservationPayload(BaseModel):
    idLocal: UUID
    idCliente: int
    fecha: date
    horario: str
    codigoSucursal: int
    idProducto: int


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


def _inventory_result(inv: Inventario) -> dict:
    return {"idInv": inv.idInv, "idEmpresa": inv.idEmpresa,
            "cantidad_actual": inv.cantidad_actual,
            "cantidad_reservada": inv.cantidad_reservada,
            "codigoSucursal": inv.codigoSucursal, "idProducto": inv.idProducto,
            "fechaActualizacion": inv.fechaActualizacion.isoformat()}


async def _apply_offline_sale(session, payload: OfflineSaleIn, auth: dict, now: datetime):
    if payload.pago.tipo != "Efectivo" or not payload.items:
        raise HTTPException(422, detail={"code": "offline_sale_invalid"})
    if payload.pago.monto < 0:
        raise HTTPException(422, detail={"code": "invalid_payment_amount"})

    permissions = set(auth.get("permisos", []))
    customer = await session.get(Cliente, payload.idCliente) if payload.idCliente is not None else None
    if "venta.ver" not in permissions:
        own = (await session.execute(select(Cliente).where(
            Cliente.idUser == int(auth["sub"])
        ))).scalar_one_or_none()
        if own is None or customer is None or own.idCliente != customer.idCliente:
            raise HTTPException(403, detail={"code": "customer_not_owned"})
    if customer is None:
        raise HTTPException(422, detail={"code": "customer_not_found"})

    quantities: dict[int, int] = {}
    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(422, detail={"code": "invalid_quantity", "idProducto": item.idProducto})
        quantities[item.idProducto] = quantities.get(item.idProducto, 0) + item.cantidad

    products = {}
    inventory = {}
    for product_id, quantity in quantities.items():
        product = (await session.execute(select(Producto).where(
            Producto.idProducto == product_id, Producto.idEmpresa == int(auth["empresa"])
        ))).scalar_one_or_none()
        inv = (await session.execute(select(Inventario).where(
            Inventario.idProducto == product_id,
            Inventario.codigoSucursal == payload.codigoSucursal,
            Inventario.idEmpresa == int(auth["empresa"]),
        ).with_for_update())).scalar_one_or_none()
        if product is None or inv is None:
            raise HTTPException(422, detail={"code": "product_or_inventory_not_found", "idProducto": product_id})
        products[product_id] = product
        inventory[product_id] = inv
        if inv.cantidad_actual - inv.cantidad_reservada < quantity:
            return {"status": "conflict", "conflict": {"code": "stock_insufficient",
                    "idProducto": product_id, "available": max(0, inv.cantidad_actual - inv.cantidad_reservada)},
                    "inventario": [_inventory_result(inv)]}

    method = MetodoPago(tipo="Efectivo", estado="Activo", fecha=now, monto=payload.pago.monto,
                        origen="offline", idUserPago=int(auth["sub"]), consumidoEn=now)
    session.add(method)
    await session.flush()
    sale = Venta(idCliente=customer.idCliente, idMetPago=method.idMetPago,
                 total=0, fecha=payload.fechaLocal, origen="offline",
                 comprobanteLocal=payload.comprobanteLocal, discrepanciaStock=False)
    session.add(sale)
    await session.flush()

    total = 0.0
    details = []
    for item in payload.items:
        product = products[item.idProducto]
        inv = inventory[item.idProducto]
        inv.cantidad_actual -= item.cantidad
        inv.fechaActualizacion = now
        price = float(product.venta)
        total += price * item.cantidad
        detail = DetalleVenta(cantidad=item.cantidad, precio_unitario=price,
                              idProducto=item.idProducto, idVenta=sale.idVenta)
        session.add(detail)
        session.add(Movimiento(tipo="venta", cantidad=-item.cantidad,
                               motivo=f"Offline sale {sale.idVenta}", idInv=inv.idInv))
        session.add(Historial(idProducto=item.idProducto, idCliente=customer.idCliente,
                              idVenta=sale.idVenta))
        details.append((detail, product.nombre))
    if round(payload.pago.monto, 2) != round(total, 2):
        raise HTTPException(422, detail={"code": "offline_payment_amount_mismatch"})
    sale.total = total
    await session.flush()
    serialized_details = [{"codigoVenta": detail.codigoVenta, "cantidad": detail.cantidad,
                           "precio_unitario": float(detail.precio_unitario),
                           "idProducto": detail.idProducto, "producto_nombre": product_name,
                           "idVenta": detail.idVenta} for detail, product_name in details]
    return {"status": "synced", "venta": {"idVenta": sale.idVenta,
            "fecha": sale.fecha.isoformat(), "total": total, "idCliente": sale.idCliente,
            "idMetPago": method.idMetPago, "detalles": serialized_details, "origen": "offline",
            "comprobanteLocal": sale.comprobanteLocal, "discrepanciaStock": False,
            "discrepanciaResueltaEn": None, "discrepanciaNota": None},
            "inventario": [_inventory_result(inventory[key]) for key in inventory]}


async def _apply_offline_reservation(session, payload: OfflineReservationPayload,
                                     auth: dict, now: datetime):
    if payload.fecha < date.today():
        raise HTTPException(422, detail={"code": "reservation_date_in_past"})
    try:
        horario = time.fromisoformat(payload.horario)
    except ValueError:
        raise HTTPException(422, detail={"code": "invalid_reservation_time"})

    permissions = set(auth.get("permisos", []))
    customer = await session.get(Cliente, payload.idCliente)
    if "reserva.gestionar" not in permissions:
        own = (await session.execute(select(Cliente).where(
            Cliente.idUser == int(auth["sub"])
        ))).scalar_one_or_none()
        if own is None or customer is None or own.idCliente != customer.idCliente:
            raise HTTPException(403, detail={"code": "customer_not_owned"})
    if customer is None:
        raise HTTPException(422, detail={"code": "customer_not_found"})

    inv = (await session.execute(select(Inventario).where(
        Inventario.idProducto == payload.idProducto,
        Inventario.codigoSucursal == payload.codigoSucursal,
        Inventario.idEmpresa == int(auth["empresa"]),
    ).with_for_update())).scalar_one_or_none()
    if inv is None:
        raise HTTPException(422, detail={"code": "inventory_not_found"})
    if inv.cantidad_actual - inv.cantidad_reservada < 1:
        return {"status": "conflict", "conflict": {"code": "stock_insufficient",
                "idProducto": payload.idProducto,
                "available": max(0, inv.cantidad_actual - inv.cantidad_reservada)},
                "inventario": [_inventory_result(inv)]}

    inv.cantidad_reservada += 1
    inv.fechaActualizacion = now
    reservation = Reserva(fecha=payload.fecha, horario=horario, estado="Pendiente",
                          idCliente=customer.idCliente, codigoSucursal=payload.codigoSucursal,
                          idProducto=payload.idProducto, idMetPago=None, montoDeposito=None)
    session.add(reservation)
    await session.flush()
    return {"status": "synced", "reserva": {"codigoReserva": reservation.codigoReserva,
            "fecha": reservation.fecha.isoformat(), "horario": reservation.horario.isoformat(),
            "estado": reservation.estado, "idCliente": reservation.idCliente,
            "codigoSucursal": reservation.codigoSucursal, "idProducto": reservation.idProducto,
            "idMetPago": None, "montoDeposito": None},
            "inventario": [_inventory_result(inv)]}


@router.post("/push")
async def push(batch: SyncPushBatch, request: Request,
               session=Depends(get_tenant_db), auth: dict = Depends(get_current_payload)):
    """Apply each queued offline operation independently and idempotently."""
    tenant_id = int(auth["empresa"])
    user_id = int(auth["sub"])
    features = (await session.execute(select(Plan.features).join(
        Suscripcion, Suscripcion.idPlan == Plan.idPlan
    ).where(Suscripcion.idEmpresa == tenant_id))).scalar_one_or_none() or []
    results = []
    seen: set[str] = set()

    for operation in batch.operations:
        local_id = str(operation.idLocal)
        body = {"tipo": operation.tipo, "payload": operation.payload}
        digest = body_hash(body)
        if local_id in seen:
            results.append({"idLocal": local_id, "status": "rejected",
                            "error": {"code": "duplicate_id_in_batch"}})
            continue
        seen.add(local_id)

        existing = (await session.execute(select(OperacionIdempotente).where(
            OperacionIdempotente.idEmpresa == tenant_id,
            OperacionIdempotente.idUser == user_id,
            OperacionIdempotente.clave == local_id,
        ))).scalar_one_or_none()
        if existing:
            if (existing.hashBody != digest or existing.metodo != request.method or
                    existing.ruta != request.url.path):
                results.append({"idLocal": local_id, "status": "rejected",
                                "error": {"code": "idempotency_key_reused"}})
            else:
                results.append({"idLocal": local_id, **existing.respuesta})
            continue

        permission = "venta.crear" if operation.tipo == "venta" else "reserva.crear"
        feature = "pos" if operation.tipo == "venta" else "reservas"
        if permission not in auth.get("permisos", []):
            results.append({"idLocal": local_id, "status": "rejected",
                            "error": {"code": "permission_denied", "permission": permission}})
            continue
        if feature not in features:
            results.append({"idLocal": local_id, "status": "rejected",
                            "error": {"code": "feature_not_in_plan", "feature": feature}})
            continue

        try:
            if operation.tipo == "venta":
                parsed = OfflineSaleIn.model_validate(operation.payload)
                if str(parsed.idLocal) != local_id:
                    raise HTTPException(422, detail={"code": "local_id_mismatch"})
            else:
                parsed = OfflineReservationPayload.model_validate(operation.payload)
                if str(parsed.idLocal) != local_id:
                    raise HTTPException(422, detail={"code": "local_id_mismatch"})

            async with session.begin_nested():
                result = (await _apply_offline_sale(session, parsed, auth, datetime.now(timezone.utc))
                          if operation.tipo == "venta" else
                          await _apply_offline_reservation(session, parsed, auth, datetime.now(timezone.utc)))
                if result["status"] == "synced":
                    session.add(OperacionIdempotente(
                        idEmpresa=tenant_id, idUser=user_id, clave=local_id,
                        metodo=request.method, ruta=request.url.path, hashBody=digest,
                        status=201, respuesta=result,
                    ))
            results.append({"idLocal": local_id, **result})
        except ValidationError as exc:
            results.append({"idLocal": local_id, "status": "rejected",
                            "error": {"code": "invalid_payload", "fields": exc.errors(include_input=False)}})
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {"code": "operation_rejected", "message": str(exc.detail)}
            results.append({"idLocal": local_id, "status": "rejected", "error": detail})

    await session.commit()
    return {"results": results}
