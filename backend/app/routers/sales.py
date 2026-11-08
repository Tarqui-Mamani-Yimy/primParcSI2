from datetime import date, datetime, time, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
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
from app.schemas.fase2 import DetalleVentaOut, VentaIn, VentaOut, ResolveDiscrepancyIn
from app.schemas.promotions import CotizacionIn
from app.security import require_feature, get_current_payload, get_plan_features, require_permiso
from app.services.disponibilidad import resolver_inventario
from app.services.recomendaciones_gemini import generar_recomendaciones_post_venta
from app.services.metodo_pago_guard import exigir_metodo_pago_consumible
from app.services.idempotency import replay_if_present, save_result
from app.services.pricing import cotizar, registrar_puntos_venta, registrar_uso_cupon
from app.services.pagos_stripe import StripeNoConfigurado, StripePagoError, obtener_payment_intent

router = APIRouter(prefix="/api/sales", tags=["sales"], dependencies=[Depends(require_feature("ventas"))])


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
        precio_lista=float(d.precio_lista) if d.precio_lista is not None else None,
        idProducto=d.idProducto,
        producto_nombre=p.nombre if p else None,
        idVenta=d.idVenta,
    )


async def _cliente_del_caller(session: AsyncSession, auth: dict) -> Cliente | None:
    """Resuelve el `Cliente` propio del usuario autenticado (mismo patron que
    `reservations.py::_cliente_del_caller`)."""
    return (
        await session.execute(select(Cliente).where(Cliente.idUser == int(auth["sub"])))
    ).scalar_one_or_none()


async def _serialize_venta(v: Venta, session: AsyncSession, detalles: list[DetalleVenta]) -> VentaOut:
    return VentaOut(
        idVenta=v.idVenta,
        fecha=v.fecha,
        total=float(v.total),
        subtotal=float(v.subtotal) if v.subtotal is not None else None,
        descuento_promociones=float(v.descuento_promociones or 0),
        descuento_cupon=float(v.descuento_cupon or 0),
        descuento_puntos=float(v.descuento_puntos or 0),
        puntos_canjeados=int(v.puntos_canjeados or 0),
        puntos_ganados=int(v.puntos_ganados or 0),
        idCliente=v.idCliente,
        idMetPago=v.idMetPago,
        detalles=[await _serialize_detalle(d, session) for d in detalles],
        origen=v.origen,
        comprobanteLocal=v.comprobanteLocal,
        discrepanciaStock=v.discrepanciaStock,
        discrepanciaResueltaEn=v.discrepanciaResueltaEn,
        discrepanciaNota=v.discrepanciaNota,
    )


@router.get("", response_model=list[VentaOut])
async def list_sales(
    idCliente: int | None = None,
    discrepancia: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_tenant_db),
    payload: dict = Depends(get_current_payload),
):
    permisos = payload.get("permisos", [])

    if "venta.ver" in permisos:
        stmt = select(Venta).order_by(Venta.fecha.desc())
        if idCliente is not None:
            stmt = stmt.where(Venta.idCliente == idCliente)
        if discrepancia is not None:
            stmt = stmt.where(Venta.discrepanciaStock.is_(discrepancia))
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
                select(Venta).where(Venta.idCliente == cliente.idCliente,
                                    *([Venta.discrepanciaStock.is_(discrepancia)] if discrepancia is not None else [])).order_by(Venta.fecha.desc())
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
async def get_sale(idVenta: int, session: AsyncSession = Depends(get_tenant_db),
                   _=Depends(require_permiso("venta.ver"))):
    v = await session.get(Venta, idVenta)
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    detalles = (
        await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == idVenta))
    ).scalars().all()
    return await _serialize_venta(v, session, detalles)


@router.patch("/{idVenta}/resolve-discrepancy")
async def resolve_discrepancy(idVenta: int, payload: ResolveDiscrepancyIn,
                              session: AsyncSession = Depends(get_tenant_db),
                              _=Depends(require_permiso("inventario.ajustar"))):
    venta = await session.get(Venta, idVenta)
    if venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if not venta.discrepanciaStock:
        raise HTTPException(status_code=409, detail={"code": "no_stock_discrepancy"})
    venta.discrepanciaResueltaEn = datetime.now()
    venta.discrepanciaNota = payload.nota
    await session.commit()
    return {"idVenta": venta.idVenta, "discrepanciaStock": venta.discrepanciaStock,
            "discrepanciaResueltaEn": venta.discrepanciaResueltaEn, "discrepanciaNota": venta.discrepanciaNota}


@router.post("/quote")
async def quote_sale(payload: CotizacionIn, session: AsyncSession = Depends(get_tenant_db),
                     auth: dict = Depends(require_permiso("venta.crear"))):
    id_cliente = payload.idCliente
    if "venta.ver" not in auth.get("permisos", []):
        cliente = await _cliente_del_caller(session, auth)
        if cliente is None:
            raise HTTPException(status_code=403, detail="La cuenta no tiene un cliente asociado")
        if id_cliente is not None and id_cliente != cliente.idCliente:
            raise HTTPException(status_code=403, detail="No puede cotizar para otro cliente")
        id_cliente = cliente.idCliente
    try:
        return await cotizar(session, int(auth["empresa"]), payload.items, id_cliente,
                             payload.codigoCupon, payload.puntos, datetime.now(timezone.utc), "online")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("", response_model=VentaOut, status_code=201)
async def create_sale(
    payload: VentaIn,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("venta.crear")),
    _pos=Depends(require_feature("pos")),
):
    idempotency_body = payload.model_dump(mode="json")
    if payload.codigoCupon is None:
        idempotency_body.pop("codigoCupon", None)
    if payload.puntos is None:
        idempotency_body.pop("puntos", None)
    pending = await replay_if_present(request, session, auth, response, idempotency_body)
    if pending is not None and not isinstance(pending, tuple):
        return pending
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un item")

    # Ownership: un caller sin "venta.ver" (Cliente) solo puede comprar para
    # si mismo — idCliente se deriva de su propio JWT, mismo patron que
    # `reservations.py::create_reservation`. Un caller staff con "venta.ver"
    # sigue especificando idCliente explicitamente (POS/CU19 sin cambios).
    es_autocompra = "venta.ver" not in auth.get("permisos", [])
    if es_autocompra:
        cliente = await _cliente_del_caller(session, auth)
        if cliente is None:
            raise HTTPException(status_code=403, detail="La cuenta no tiene un cliente asociado")
        if payload.idCliente is not None and payload.idCliente != cliente.idCliente:
            raise HTTPException(status_code=403, detail="No puede comprar en nombre de otro cliente")
        id_cliente = cliente.idCliente
    else:
        id_cliente = payload.idCliente

    if id_cliente is None or not await session.get(Cliente, id_cliente):
        raise HTTPException(status_code=400, detail="Cliente inexistente")

    try:
        quote = await cotizar(session, int(auth["empresa"]), payload.items, id_cliente,
                              payload.codigoCupon, payload.puntos, datetime.now(timezone.utc), "online")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    features = await get_plan_features(session, int(auth["empresa"]))
    if payload.codigoCupon and quote["idCupon"] is None and "promociones" in features:
        raise HTTPException(status_code=400, detail=quote["avisos"][-1] if quote["avisos"] else "Cupón inválido o vencido")
    if payload.puntos and quote["puntos_canjeados"] != payload.puntos and "fidelizacion" in features:
        raise HTTPException(status_code=400, detail="Los puntos solicitados superan el saldo o el límite de canje")

    metodo_pago = await session.get(MetodoPago, payload.idMetPago)
    if metodo_pago is not None and metodo_pago.origen == "tarjeta_stripe":
        try:
            intent = await obtener_payment_intent(metodo_pago.stripePaymentIntentId)
        except StripeNoConfigurado:
            raise HTTPException(status_code=503, detail="Stripe no esta configurado en este servidor")
        except StripePagoError:
            raise HTTPException(status_code=502, detail="No se pudo verificar el intento de pago con Stripe")
        metadata = intent.get("metadata") or {}
        expected = (str(id_cliente), (payload.codigoCupon or "").strip().upper(), str(payload.puntos or 0))
        actual = (str(metadata.get("idCliente", "")), (metadata.get("codigoCupon") or "").strip().upper(),
                  str(int(metadata.get("puntos") or 0)))
        if actual != expected:
            raise HTTPException(status_code=409, detail="La venta no coincide con los datos cotizados en el pago")

    # Guard centralizado (Payment Method Single-Use Across Sales / Cross-Table
    # Single-Use): ownership + origen tarjeta_stripe para autocompra, y ahora
    # ademas rechaza un idMetPago ya consumido por CUALQUIER Venta O Reserva
    # (antes solo se miraba Venta). exigir_tarjeta == es_autocompra: mismo
    # criterio previo ("venta.ver" not in permisos), sin cambio de semantica.
    await exigir_metodo_pago_consumible(session, payload.idMetPago, int(auth["sub"]), es_autocompra)

    if metodo_pago is not None and metodo_pago.origen == "tarjeta_stripe" and round(float(metodo_pago.monto), 2) != round(quote["total"], 2):
        raise HTTPException(status_code=409, detail="El monto cobrado no coincide con el total de la venta")

    venta = Venta(total=quote["total"], subtotal=quote["subtotal"],
                  descuento_promociones=quote["descuento_promociones"],
                  descuento_cupon=quote["descuento_cupon"], descuento_puntos=quote["descuento_puntos"],
                  idCupon=quote["idCupon"], puntos_canjeados=quote["puntos_canjeados"],
                  puntos_ganados=quote["puntos_a_ganar"], idCliente=id_cliente, idMetPago=payload.idMetPago)
    session.add(venta)
    await session.flush()

    for item, priced in zip(payload.items, quote["lineas"]):
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="cantidad debe ser > 0")
        producto = await session.get(Producto, item.idProducto)
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto {item.idProducto} inexistente")

        if payload.codigoSucursal is not None:
            inv = (
                await session.execute(
                    select(Inventario).where(
                        Inventario.idProducto == item.idProducto,
                        Inventario.codigoSucursal == payload.codigoSucursal,
                        Inventario.cantidad_reservada < Inventario.cantidad_actual,
                    ).order_by(Inventario.idInv)
                )
            ).scalars().first()
            if inv is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stock insuficiente del producto {item.idProducto} "
                        f"en la sucursal {payload.codigoSucursal}"
                    ),
                )

            if inv.cantidad_actual - inv.cantidad_reservada < item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stock disponible insuficiente del producto {item.idProducto} "
                        f"en la sucursal {payload.codigoSucursal}"
                    ),
                )
        else:
            # Compra en linea sin sucursal explicita (D4): se resuelve la
            # UNICA fila de Inventario, entre todas las sucursales, cuya
            # disponibilidad por si sola cubre la cantidad pedida — nunca se
            # suma disponibilidad entre sucursales.
            inv = await resolver_inventario(session, item.idProducto, item.cantidad, None)
            if inv is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Ninguna sucursal tiene stock disponible suficiente del "
                        f"producto {item.idProducto} para la cantidad solicitada"
                    ),
                )

        precio_unitario = priced["precio_unitario"]
        inv.cantidad_actual -= item.cantidad

        detalle = DetalleVenta(
            cantidad=item.cantidad,
            precio_unitario=precio_unitario,
            precio_lista=priced["precio_lista"],
            idPromocion=priced["idPromocion"],
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
                idCliente=id_cliente,
                idVenta=venta.idVenta,
            )
        )
        await session.flush()

    try:
        await registrar_uso_cupon(session, quote, int(auth["empresa"]), id_cliente, venta.idVenta, venta.fecha)
        await registrar_puntos_venta(session, quote, int(auth["empresa"]), id_cliente, venta.idVenta, venta.fecha)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await _registrar_bitacora(session, f"Venta {venta.idVenta} creada", int(auth["sub"]), request.client.host if request.client else "0.0.0.0")
    await session.flush()

    # CU22: recomendaciones generadas en background, DESPUES del commit —
    # nunca demora la respuesta de la venta, y si Gemini falla la venta ya
    # quedo persistida de todos modos (ver recomendaciones_gemini.py).
    background_tasks.add_task(
        generar_recomendaciones_post_venta,
        id_cliente=id_cliente,
        tenant_id=session.info["tenant_id"],
    )

    detalles = (
        await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == venta.idVenta))
    ).scalars().all()
    serialized = await _serialize_venta(venta, session, detalles)
    result = serialized.model_dump(mode="json")
    await save_result(session, pending, auth, request, 201, result)
    await session.commit()
    return serialized
