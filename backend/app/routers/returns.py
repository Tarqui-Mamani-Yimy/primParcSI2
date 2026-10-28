from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.models import (
    Devolucion,
    DevolucionDetalle,
    DevolucionReemplazo,
    DetalleVenta,
    Inventario,
    MetodoPago,
    MovimientoCaja,
    Movimiento,
    Producto,
    Venta,
)
from app.schemas.returns import CreateExchangeIn, CreateReturnIn, ReturnItemIn, ReturnOut, ReturnableItemOut
from app.security import require_permiso
from app.services.bitacora import registrar_bitacora
from app.services.inventory_stock import adjust_inventory_and_record_movement
from app.services.pagos_stripe import (
    StripeNoConfigurado,
    StripePagoError,
    crear_payment_intent,
    crear_refund,
    obtener_refund,
    obtener_payment_intent,
)

router = APIRouter(prefix="/api/returns", tags=["returns"])
CENT = Decimal("0.01")
PENDING_STATES = ("payment_pending", "payment_failed", "completed")


def _money(value: Decimal | int | float) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def _sale_date(sale: Venta) -> datetime:
    sold_at = sale.fecha
    if sold_at.tzinfo is None:
        return sold_at.replace(tzinfo=timezone.utc)
    return sold_at.astimezone(timezone.utc)


def _require_return_window(sale: Venta) -> None:
    now = datetime.now(timezone.utc)
    sold_at = _sale_date(sale)
    if sold_at > now or now - sold_at > timedelta(days=30):
        raise HTTPException(
            status_code=409,
            detail={"code": "return_window_expired", "message": "Returns are allowed within 30 days of sale."},
        )


async def _get_sale(session: AsyncSession, sale_id: int, tenant_id: int) -> Venta:
    sale = (
        await session.execute(
            select(Venta)
            .where(Venta.idVenta == sale_id, Venta.idEmpresa == tenant_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if sale is None:
        raise HTTPException(status_code=404, detail={"code": "sale_not_found"})
    _require_return_window(sale)
    return sale


async def _get_payment_method(session: AsyncSession, sale: Venta, tenant_id: int) -> MetodoPago:
    method = (
        await session.execute(
            select(MetodoPago).where(
                MetodoPago.idMetPago == sale.idMetPago,
                MetodoPago.idEmpresa == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if method is None:
        raise HTTPException(status_code=409, detail={"code": "sale_payment_method_not_found"})
    return method


def _is_stripe(method: MetodoPago) -> bool:
    return bool(method.stripePaymentIntentId) or method.origen == "tarjeta_stripe" or "stripe" in method.tipo.casefold()


def _require_supported_payment_method(method: MetodoPago) -> None:
    if _is_stripe(method) or method.tipo.strip().casefold() in {"efectivo", "cash"}:
        return
    raise HTTPException(status_code=409, detail={"code": "unsupported_sale_payment_method"})


async def _get_sale_item(
    session: AsyncSession,
    sale_id: int,
    sale_item_id: int,
    tenant_id: int,
) -> DetalleVenta:
    item = (
        await session.execute(
            select(DetalleVenta).where(
                DetalleVenta.codigoVenta == sale_item_id,
                DetalleVenta.idVenta == sale_id,
                DetalleVenta.idEmpresa == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "sale_item_not_found"})
    return item


async def _already_returned(session: AsyncSession, sale_item_id: int, tenant_id: int) -> int:
    quantity = await session.execute(
        select(func.coalesce(func.sum(DevolucionDetalle.quantity), 0))
        .join(Devolucion, Devolucion.idDevolucion == DevolucionDetalle.return_id)
        .where(
            DevolucionDetalle.sale_item_id == sale_item_id,
            DevolucionDetalle.idEmpresa == tenant_id,
            Devolucion.idEmpresa == tenant_id,
            Devolucion.estado.in_(PENDING_STATES),
        )
    )
    return int(quantity.scalar_one())


async def _sold_inventory(
    session: AsyncSession,
    sale: Venta,
    item: DetalleVenta,
    tenant_id: int,
) -> Inventario:
    movement_reasons = (f"Venta {sale.idVenta}", f"Offline sale {sale.idVenta}")
    inventory = (
        await session.execute(
            select(Inventario)
            .join(Movimiento, Movimiento.idInv == Inventario.idInv)
            .where(
                Movimiento.idEmpresa == tenant_id,
                Movimiento.tipo == "venta",
                Movimiento.motivo.in_(movement_reasons),
                Inventario.idEmpresa == tenant_id,
                Inventario.idProducto == item.idProducto,
            )
            .order_by(Movimiento.idMov)
            .with_for_update()
        )
    ).scalars().first()
    if inventory is None:
        raise HTTPException(
            status_code=409,
            detail={"code": "sale_inventory_location_unavailable"},
        )
    return inventory


async def _validate_return_items(session: AsyncSession, sale: Venta, items, tenant_id: int):
    validated = []
    total = Decimal("0.00")
    requested_quantities: dict[int, int] = {}
    for request_item in items:
        requested_quantities[request_item.sale_item_id] = (
            requested_quantities.get(request_item.sale_item_id, 0) + int(request_item.quantity)
        )
    for sale_item_id, quantity in requested_quantities.items():
        item = await _get_sale_item(session, sale.idVenta, sale_item_id, tenant_id)
        prior_quantity = await _already_returned(session, item.codigoVenta, tenant_id)
        if quantity > item.cantidad - prior_quantity:
            raise HTTPException(
                status_code=409,
                detail={"code": "return_quantity_exceeded", "sale_item_id": item.codigoVenta,
                        "returnable_quantity": max(0, item.cantidad - prior_quantity)},
            )
        inventory = await _sold_inventory(session, sale, item, tenant_id)
        line_total = _money(Decimal(str(item.precio_unitario)) * quantity)
        total += line_total
        validated.append((item, inventory, quantity, line_total))
    return validated, _money(total)


async def _new_return(
    session: AsyncSession,
    *,
    sale: Venta,
    auth: dict,
    tenant_id: int,
    return_type: str,
    refund_amount: Decimal,
    amount_due: Decimal,
    payment_method: str,
    status_value: str,
) -> Devolucion:
    result = Devolucion(
        idEmpresa=tenant_id,
        idVenta=sale.idVenta,
        idUser=int(auth["sub"]),
        tipo=return_type,
        estado=status_value,
        montoReembolso=refund_amount,
        montoCobrado=amount_due,
        metodoPago=payment_method,
    )
    session.add(result)
    await session.flush()
    return result


async def _record_return_items(session: AsyncSession, record: Devolucion, validated, tenant_id: int) -> None:
    for item, inventory, quantity, _line_total in validated:
        session.add(DevolucionDetalle(
            idEmpresa=tenant_id,
            return_id=record.idDevolucion,
            sale_item_id=item.codigoVenta,
            quantity=quantity,
            unit_price=item.precio_unitario,
            inventory_id=inventory.idInv,
        ))


async def _replacement_stock(
    session: AsyncSession,
    *,
    product_id: int,
    quantity: int,
    branch_id: int,
    tenant_id: int,
) -> tuple[Producto, Inventario]:
    product = (
        await session.execute(
            select(Producto).where(Producto.idProducto == product_id, Producto.idEmpresa == tenant_id)
        )
    ).scalar_one_or_none()
    inventory = (
        await session.execute(
            select(Inventario)
            .where(
                Inventario.idEmpresa == tenant_id,
                Inventario.codigoSucursal == branch_id,
                Inventario.idProducto == product_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if product is None or inventory is None:
        raise HTTPException(status_code=404, detail={"code": "replacement_product_or_stock_not_found"})
    if inventory.cantidad_actual - inventory.cantidad_reservada < quantity:
        raise HTTPException(status_code=409, detail={"code": "replacement_stock_insufficient"})
    return product, inventory


def _reserve_replacement(inventory: Inventario, quantity: int) -> None:
    inventory.cantidad_reservada += quantity


async def _record_replacement(
    session: AsyncSession,
    record: Devolucion,
    product: Producto,
    inventory: Inventario,
    quantity: int,
    tenant_id: int,
) -> None:
    session.add(DevolucionReemplazo(
        idEmpresa=tenant_id,
        return_id=record.idDevolucion,
        product_id=product.idProducto,
        quantity=quantity,
        unit_price=product.venta,
        inventory_id=inventory.idInv,
    ))


async def _cash_movement(
    session: AsyncSession,
    record: Devolucion,
    *,
    tenant_id: int,
    user_id: int,
    branch_id: int,
    kind: str,
    amount: Decimal,
) -> None:
    if amount <= 0:
        return
    session.add(MovimientoCaja(
        idEmpresa=tenant_id,
        return_id=record.idDevolucion,
        branch_id=branch_id,
        user_id=user_id,
        kind=kind,
        amount=amount,
        concept=f"CU31 {record.tipo} {record.idDevolucion}",
    ))


async def _log(session: AsyncSession, request: Request, auth: dict, tenant_id: int, action: str) -> None:
    ip = request.client.host if request.client else "0.0.0.0"
    await registrar_bitacora(session, action, int(auth["sub"]), ip, idEmpresa=tenant_id)


async def _finalize(session: AsyncSession, record: Devolucion, auth: dict, request: Request, tenant_id: int) -> None:
    if record.estado == "completed":
        return
    details = (
        await session.execute(
            select(DevolucionDetalle).where(
                DevolucionDetalle.return_id == record.idDevolucion,
                DevolucionDetalle.idEmpresa == tenant_id,
            )
        )
    ).scalars().all()
    for detail in details:
        inventory = (
            await session.execute(
                select(Inventario).where(
                    Inventario.idInv == detail.inventory_id,
                    Inventario.idEmpresa == tenant_id,
                ).with_for_update()
            )
        ).scalar_one()
        adjust_inventory_and_record_movement(
            session,
            inventory,
            new_quantity=inventory.cantidad_actual + detail.quantity,
            movement_quantity=detail.quantity,
            movement_type="devolucion",
            reason=f"Devolucion {record.idDevolucion}",
            reference=str(record.idDevolucion),
        )

    replacements = (
        await session.execute(
            select(DevolucionReemplazo).where(
                DevolucionReemplazo.return_id == record.idDevolucion,
                DevolucionReemplazo.idEmpresa == tenant_id,
            )
        )
    ).scalars().all()
    for replacement in replacements:
        inventory = (
            await session.execute(
                select(Inventario).where(
                    Inventario.idInv == replacement.inventory_id,
                    Inventario.idEmpresa == tenant_id,
                ).with_for_update()
            )
        ).scalar_one()
        if inventory.cantidad_reservada < replacement.quantity:
            raise HTTPException(status_code=409, detail={"code": "replacement_reservation_missing"})
        inventory.cantidad_reservada -= replacement.quantity
        if inventory.cantidad_actual < replacement.quantity:
            raise HTTPException(status_code=409, detail={"code": "replacement_stock_insufficient"})
        adjust_inventory_and_record_movement(
            session,
            inventory,
            new_quantity=inventory.cantidad_actual - replacement.quantity,
            movement_quantity=-replacement.quantity,
            movement_type="cambio_salida",
            reason=f"Cambio {record.idDevolucion}",
            reference=str(record.idDevolucion),
        )
    record.estado = "completed"
    await _log(
        session, request, auth, tenant_id,
        "devolucion.completada" if record.tipo == "devolucion" else "cambio.completado",
    )
    await session.commit()


async def _output(record: Devolucion) -> ReturnOut:
    return ReturnOut(
        id=record.idDevolucion,
        sale_id=record.idVenta,
        type=record.tipo,
        status=record.estado,
        refund_amount=_money(record.montoReembolso),
        amount_due=_money(record.montoCobrado),
        payment_method=record.metodoPago,
        payment_intent_id=record.stripePaymentIntentId,
        stripe_refund_id=record.stripeRefundId,
        created_at=record.fecha,
    )


async def _get_return(
    session: AsyncSession, return_id: int, tenant_id: int, *, lock: bool = False
) -> Devolucion:
    statement = select(Devolucion).where(
        Devolucion.idDevolucion == return_id,
        Devolucion.idEmpresa == tenant_id,
    )
    if lock:
        statement = statement.with_for_update().execution_options(populate_existing=True)
    record = (await session.execute(statement)).scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "return_not_found"})
    return record


async def _refund_and_finalize(
    session: AsyncSession,
    record: Devolucion,
    auth: dict,
    request: Request,
    tenant_id: int,
) -> None:
    record = await _get_return(session, record.idDevolucion, tenant_id, lock=True)
    if record.estado == "completed":
        return
    sale = await _get_sale_without_window(session, record.idVenta, tenant_id)
    method = await _get_payment_method(session, sale, tenant_id)
    if not method.stripePaymentIntentId:
        raise HTTPException(status_code=409, detail={"code": "stripe_payment_intent_missing"})
    try:
        if record.stripeRefundId and record.estado == "payment_pending":
            refund = await obtener_refund(record.stripeRefundId)
        else:
            record.stripeRefundAttempts += 1
            refund = await crear_refund(
                payment_intent_id=method.stripePaymentIntentId,
                amount=_money(record.montoReembolso),
                idempotency_key=(
                    f"cu31-refund:{tenant_id}:{record.idDevolucion}:"
                    f"{record.stripeRefundAttempts}"
                ),
            )
    except StripeNoConfigurado as exc:
        raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"}) from exc
    except StripePagoError as exc:
        raise HTTPException(status_code=502, detail={"code": "stripe_refund_failed"}) from exc
    record.stripeRefundId = refund["id"]
    if refund["status"] in {"failed", "canceled"}:
        record.estado = "payment_failed"
        await session.commit()
        return
    if refund["status"] != "succeeded":
        record.estado = "payment_pending"
        await session.commit()
        return
    await _finalize(session, record, auth, request, tenant_id)


async def _get_sale_without_window(session: AsyncSession, sale_id: int, tenant_id: int) -> Venta:
    sale = (
        await session.execute(
            select(Venta).where(Venta.idVenta == sale_id, Venta.idEmpresa == tenant_id)
        )
    ).scalar_one_or_none()
    if sale is None:
        raise HTTPException(status_code=404, detail={"code": "sale_not_found"})
    return sale


@router.get("/sales/{sale_id}/returnable-items", response_model=list[ReturnableItemOut])
async def list_returnable_items(
    sale_id: int,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.ver")),
):
    tenant_id = int(auth["empresa"])
    sale = await _get_sale(session, sale_id, tenant_id)
    details = (
        await session.execute(
            select(DetalleVenta).where(
                DetalleVenta.idVenta == sale.idVenta,
                DetalleVenta.idEmpresa == tenant_id,
            ).order_by(DetalleVenta.codigoVenta)
        )
    ).scalars().all()
    result = []
    for item in details:
        product = (
            await session.execute(
                select(Producto).where(
                    Producto.idProducto == item.idProducto,
                    Producto.idEmpresa == tenant_id,
                )
            )
        ).scalar_one()
        returned = await _already_returned(session, item.codigoVenta, tenant_id)
        result.append(ReturnableItemOut(
            sale_item_id=item.codigoVenta,
            product_id=item.idProducto,
            product_name=product.nombre,
            sold_quantity=item.cantidad,
            returned_quantity=returned,
            returnable_quantity=max(0, item.cantidad - returned),
            unit_price=_money(item.precio_unitario),
        ))
    return result


@router.post("", response_model=ReturnOut, status_code=status.HTTP_201_CREATED)
async def create_return(
    payload: CreateReturnIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.gestionar")),
):
    tenant_id = int(auth["empresa"])
    sale = await _get_sale(session, payload.sale_id, tenant_id)
    method = await _get_payment_method(session, sale, tenant_id)
    _require_supported_payment_method(method)
    validated, refund_amount = await _validate_return_items(session, sale, payload.items, tenant_id)
    if refund_amount <= 0:
        raise HTTPException(status_code=409, detail={"code": "refund_amount_invalid"})

    stripe_refund = _is_stripe(method)
    record = await _new_return(
        session, sale=sale, auth=auth, tenant_id=tenant_id, return_type="devolucion",
        refund_amount=refund_amount, amount_due=Decimal("0.00"),
        payment_method="stripe" if stripe_refund else "cash",
        status_value="payment_pending",
    )
    await _record_return_items(session, record, validated, tenant_id)
    if not stripe_refund:
        branch_id = validated[0][1].codigoSucursal
        await _cash_movement(
            session, record, tenant_id=tenant_id, user_id=int(auth["sub"]),
            branch_id=branch_id, kind="egreso", amount=refund_amount,
        )
        await _finalize(session, record, auth, request, tenant_id)
        return await _output(record)

    await _log(session, request, auth, tenant_id, "devolucion.iniciada")
    await session.commit()
    await _refund_and_finalize(session, record, auth, request, tenant_id)
    if record.estado != "completed":
        response.status_code = status.HTTP_202_ACCEPTED
    return await _output(record)


@router.post("/exchanges", response_model=ReturnOut, status_code=status.HTTP_201_CREATED)
async def create_exchange(
    payload: CreateExchangeIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.gestionar")),
):
    tenant_id = int(auth["empresa"])
    sale = await _get_sale(session, payload.sale_id, tenant_id)
    method = await _get_payment_method(session, sale, tenant_id)
    _require_supported_payment_method(method)
    validated, original_amount = await _validate_return_items(
        session, sale,
        [ReturnItemIn(sale_item_id=payload.sale_item_id, quantity=payload.quantity)],
        tenant_id,
    )
    old_item, old_inventory, old_quantity, _ = validated[0]
    replacement, replacement_inventory = await _replacement_stock(
        session,
        product_id=payload.replacement_product_id,
        quantity=payload.replacement_quantity,
        branch_id=old_inventory.codigoSucursal,
        tenant_id=tenant_id,
    )
    replacement_amount = _money(Decimal(str(replacement.venta)) * payload.replacement_quantity)
    difference = _money(replacement_amount - original_amount)
    refund_amount = max(Decimal("0.00"), -difference)
    amount_due = max(Decimal("0.00"), difference)
    stripe_method = _is_stripe(method)
    needs_external_payment = stripe_method and amount_due > 0
    needs_stripe_refund = stripe_method and refund_amount > 0

    record = await _new_return(
        session, sale=sale, auth=auth, tenant_id=tenant_id, return_type="cambio",
        refund_amount=refund_amount, amount_due=amount_due,
        payment_method="stripe" if stripe_method else "cash",
        status_value="payment_pending",
    )
    await _record_return_items(session, record, validated, tenant_id)
    await _record_replacement(
        session, record, replacement, replacement_inventory, payload.replacement_quantity, tenant_id
    )
    _reserve_replacement(replacement_inventory, payload.replacement_quantity)

    if amount_due > 0 and stripe_method:
        try:
            intent = await crear_payment_intent(
                monto_usd=amount_due,
                clave_idempotencia=f"cu31-exchange:{tenant_id}:{record.idDevolucion}",
                metadata={"type": "cu31_exchange", "return_id": str(record.idDevolucion),
                          "sale_id": str(sale.idVenta), "tenant_id": str(tenant_id)},
            )
        except StripeNoConfigurado as exc:
            await session.rollback()
            raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"}) from exc
        except StripePagoError as exc:
            await session.rollback()
            raise HTTPException(status_code=502, detail={"code": "stripe_payment_intent_failed"}) from exc
        record.stripePaymentIntentId = intent["id"]
        await _log(session, request, auth, tenant_id, "cambio.pago_pendiente")
        await session.commit()
        result = await _output(record)
        result = result.model_copy(update={"client_secret": intent["client_secret"]})
        response.status_code = status.HTTP_201_CREATED
        return result

    if refund_amount > 0 and stripe_method:
        await _log(session, request, auth, tenant_id, "cambio.reembolso_pendiente")
        await session.commit()
        await _refund_and_finalize(session, record, auth, request, tenant_id)
        if record.estado != "completed":
            response.status_code = status.HTTP_202_ACCEPTED
        return await _output(record)

    if not stripe_method and refund_amount > 0:
        await _cash_movement(
            session, record, tenant_id=tenant_id, user_id=int(auth["sub"]),
            branch_id=old_inventory.codigoSucursal, kind="egreso", amount=refund_amount,
        )
    elif not stripe_method and amount_due > 0:
        await _cash_movement(
            session, record, tenant_id=tenant_id, user_id=int(auth["sub"]),
            branch_id=old_inventory.codigoSucursal, kind="ingreso", amount=amount_due,
        )
    await _finalize(session, record, auth, request, tenant_id)
    return await _output(record)


@router.post("/{return_id}/confirm-payment", response_model=ReturnOut)
async def confirm_exchange_payment(
    return_id: int,
    request: Request,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.gestionar")),
):
    tenant_id = int(auth["empresa"])
    record = await _get_return(session, return_id, tenant_id, lock=True)
    if record.tipo != "cambio" or not record.stripePaymentIntentId:
        raise HTTPException(status_code=409, detail={"code": "exchange_payment_not_pending"})
    if record.estado == "completed":
        return await _output(record)
    if record.estado != "payment_pending":
        raise HTTPException(status_code=409, detail={"code": "exchange_not_pending"})
    try:
        intent = await obtener_payment_intent(record.stripePaymentIntentId)
    except StripeNoConfigurado as exc:
        raise HTTPException(status_code=503, detail={"code": "stripe_not_configured"}) from exc
    except StripePagoError as exc:
        raise HTTPException(status_code=502, detail={"code": "stripe_payment_verification_failed"}) from exc
    expected_cents = int((_money(record.montoCobrado) * 100).quantize(Decimal("1")))
    if intent["status"] != "succeeded" or int(intent["amount_received"] or 0) != expected_cents:
        raise HTTPException(status_code=409, detail={"code": "exchange_payment_not_confirmed"})

    method = MetodoPago(
        idEmpresa=tenant_id,
        tipo="Tarjeta (Stripe)",
        estado="Activo",
        monto=record.montoCobrado,
        stripePaymentIntentId=intent["id"],
        moneda=intent.get("currency"),
        estadoStripe=intent["status"],
        origen="tarjeta_stripe",
        idUserPago=int(auth["sub"]),
        consumidoEn=datetime.now(timezone.utc),
    )
    session.add(method)
    await _finalize(session, record, auth, request, tenant_id)
    return await _output(record)


@router.post("/{return_id}/process", response_model=ReturnOut)
async def process_pending_refund(
    return_id: int,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.gestionar")),
):
    tenant_id = int(auth["empresa"])
    record = await _get_return(session, return_id, tenant_id, lock=True)
    if record.estado == "completed":
        return await _output(record)
    if record.estado not in {"payment_pending", "payment_failed"} or record.montoReembolso <= 0:
        raise HTTPException(status_code=409, detail={"code": "refund_not_pending"})
    await _refund_and_finalize(session, record, auth, request, tenant_id)
    if record.estado != "completed":
        response.status_code = status.HTTP_202_ACCEPTED
    return await _output(record)


@router.get("", response_model=list[ReturnOut])
async def list_returns(
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.ver")),
):
    rows = (
        await session.execute(
            select(Devolucion)
            .where(Devolucion.idEmpresa == int(auth["empresa"]))
            .order_by(Devolucion.fecha.desc(), Devolucion.idDevolucion.desc())
        )
    ).scalars().all()
    return [await _output(record) for record in rows]


@router.get("/{return_id}", response_model=dict)
async def get_return(
    return_id: int,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("devolucion.ver")),
):
    tenant_id = int(auth["empresa"])
    record = await _get_return(session, return_id, tenant_id)
    details = (
        await session.execute(
            select(DevolucionDetalle).where(
                DevolucionDetalle.return_id == record.idDevolucion,
                DevolucionDetalle.idEmpresa == tenant_id,
            )
        )
    ).scalars().all()
    replacements = (
        await session.execute(
            select(DevolucionReemplazo).where(
                DevolucionReemplazo.return_id == record.idDevolucion,
                DevolucionReemplazo.idEmpresa == tenant_id,
            )
        )
    ).scalars().all()
    result = (await _output(record)).model_dump(mode="json")
    result["items"] = [
        {"sale_item_id": item.sale_item_id, "quantity": item.quantity,
         "unit_price": str(_money(item.unit_price))}
        for item in details
    ]
    result["replacements"] = [
        {"product_id": item.product_id, "quantity": item.quantity,
         "unit_price": str(_money(item.unit_price))}
        for item in replacements
    ]
    return result
