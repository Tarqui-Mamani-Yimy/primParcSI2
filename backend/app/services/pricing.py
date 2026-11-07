"""Shared, transaction-scoped pricing and loyalty ledger operations."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, ROUND_UP
from math import floor

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models import (
    Cliente,
    Colecciones,
    Cupon,
    CuponUso,
    CuentaPuntos,
    MovimientoPuntos,
    Producto,
    Promocion,
)

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
POINT_VALUE = Decimal("0.10")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def nivel_puntos(acumulado_historico: int) -> dict:
    earned = max(0, int(acumulado_historico or 0))
    if earned >= 5000:
        return {"nivel": "Oro", "multiplicador": 1.5, "siguiente_nivel": None, "puntos_para_siguiente": 0}
    if earned >= 2000:
        return {"nivel": "Plata", "multiplicador": 1.25, "siguiente_nivel": "Oro", "puntos_para_siguiente": 5000 - earned}
    return {"nivel": "Bronce", "multiplicador": 1.0, "siguiente_nivel": "Plata", "puntos_para_siguiente": 2000 - earned}


def puntos_por_venta(total, acumulado_historico: int) -> int:
    level = nivel_puntos(acumulado_historico)
    return floor((_money(total) / Decimal(10)) * Decimal(str(level["multiplicador"])))


async def _asegurar_cuenta(session, tenant_id: int, id_cliente: int) -> None:
    dialect = session.session.get_bind().dialect.name if hasattr(session, "session") else session.bind.dialect.name
    values = {"idCliente": id_cliente, "idEmpresa": tenant_id, "saldo": 0, "acumulado_historico": 0}
    if dialect == "postgresql":
        statement = pg_insert(CuentaPuntos).values(**values).on_conflict_do_nothing(index_elements=["idCliente"])
    elif dialect == "sqlite":
        statement = sqlite_insert(CuentaPuntos).values(**values).on_conflict_do_nothing(index_elements=["idCliente"])
    else:
        existing = await session.get(CuentaPuntos, id_cliente)
        if existing is None:
            session.add(CuentaPuntos(**values))
            await session.flush()
        return
    await session.execute(statement)


async def cuenta_bloqueada(session, tenant_id: int, id_cliente: int, *, crear: bool = False):
    if crear:
        await _asegurar_cuenta(session, tenant_id, id_cliente)
    result = await session.execute(
        select(CuentaPuntos)
        .where(CuentaPuntos.idCliente == id_cliente, CuentaPuntos.idEmpresa == tenant_id)
        .with_for_update()
    )
    return result.scalar_one_or_none()


def _line_item(item) -> tuple[int, int]:
    if isinstance(item, dict):
        product_id, quantity = item.get("idProducto"), item.get("cantidad")
    else:
        product_id, quantity = item.idProducto, item.cantidad
    return int(product_id), int(quantity)


def _same_date(start: datetime, end: datetime, instant: datetime) -> bool:
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return start <= instant <= end


async def _promotions(session, tenant_id: int, fecha: datetime, canal: str):
    if canal == "reserva":
        return []
    result = await session.execute(
        select(Promocion)
        .where(Promocion.idEmpresa == tenant_id, Promocion.activa.is_(True))
        .order_by(Promocion.idPromocion)
    )
    return [promotion for promotion in result.scalars().all() if _same_date(promotion.fecha_inicio, promotion.fecha_fin, fecha)]


async def _promo_matches(session, promo: Promocion, product: Producto) -> bool:
    if promo.alcance == "todos":
        return True
    ref = str(promo.alcance_ref or "").strip().casefold()
    if promo.alcance == "producto":
        return ref == str(product.idProducto).casefold()
    if promo.alcance == "coleccion":
        return ref == str(product.idColeccion).casefold()
    if promo.alcance == "tipo":
        return ref == str(product.tipo or "").casefold()
    if promo.alcance == "temporada":
        result = await session.execute(
            select(Colecciones.idTemporada).where(
                Colecciones.idColeccion == product.idColeccion,
                Colecciones.idEmpresa == product.idEmpresa,
            )
        )
        season_id = result.scalar_one_or_none()
        return season_id is not None and ref == str(season_id).casefold()
    return False


def _promotion_discount(promo: Promocion, price: Decimal, quantity: int) -> Decimal:
    if promo.tipo == "porcentaje":
        amount = price * quantity * Decimal(str(promo.valor)) / Decimal(100)
    elif promo.tipo == "monto_fijo":
        amount = min(price, _money(promo.valor)) * quantity
    else:
        free_units = (quantity // int(promo.n)) * (int(promo.n) - int(promo.m))
        amount = price * free_units
    return min(price * quantity, amount.quantize(CENT, rounding=ROUND_HALF_UP))


def _allocate(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    total = max(ZERO, _money(total))
    weight_sum = sum(weights, ZERO)
    if not weights or total == ZERO or weight_sum <= ZERO:
        return [ZERO for _ in weights]
    allocated = []
    remaining = total
    for weight in weights[:-1]:
        share = (total * weight / weight_sum).quantize(CENT, rounding=ROUND_DOWN)
        share = min(max(ZERO, share), remaining)
        allocated.append(share)
        remaining -= share
    allocated.append(remaining)
    return allocated


def _price_lines(target_amounts: list[Decimal], quantities: list[int]) -> list[Decimal]:
    if not target_amounts:
        return []
    # Unit prices are persisted at cent precision and multiplied by quantity.
    # Rounding a unit down can make the realized discount exceed a requested
    # coupon/points cap; round up so persisted line totals never undercut their
    # allocated post-discount amounts. The reported effective discount is then
    # derived from these exact persisted prices.
    return [
        max(ZERO, (amount / quantity).quantize(CENT, rounding=ROUND_UP))
        for amount, quantity in zip(target_amounts, quantities)
    ]


async def _cupon_valido(session, tenant_id: int, codigo: str | None, id_cliente: int | None,
                        fecha: datetime, subtotal: Decimal, avisos: list[str]):
    if not codigo:
        return None
    normalized = codigo.strip().upper()
    result = await session.execute(
        select(Cupon)
        .where(Cupon.idEmpresa == tenant_id, Cupon.codigo == normalized)
        .with_for_update()
    )
    coupon = result.scalar_one_or_none()
    if coupon is None or not coupon.activo or not _same_date(coupon.fecha_inicio, coupon.fecha_fin, fecha):
        avisos.append("Cupón inválido o vencido")
        return None
    if coupon.idCliente is not None and coupon.idCliente != id_cliente:
        avisos.append("Cupón inválido o vencido")
        return None
    if subtotal < _money(coupon.minimo_compra):
        avisos.append("No alcanza el mínimo de compra")
        return None
    if id_cliente is not None and coupon.un_uso_por_cliente:
        used = await session.execute(
            select(CuponUso.idCuponUso).where(
                CuponUso.idEmpresa == tenant_id,
                CuponUso.idCupon == coupon.idCupon,
                CuponUso.idCliente == id_cliente,
            ).limit(1)
        )
        if used.scalar_one_or_none() is not None:
            avisos.append("Ya usaste este cupón")
            return None
    if coupon.usos_maximos is not None:
        count = await session.execute(
            select(func.count(CuponUso.idCuponUso)).where(
                CuponUso.idEmpresa == tenant_id,
                CuponUso.idCupon == coupon.idCupon,
            )
        )
        if int(count.scalar_one() or 0) >= coupon.usos_maximos:
            avisos.append("Cupón inválido o vencido")
            return None
    return coupon


def _coupon_discount(coupon: Cupon, subtotal: Decimal) -> Decimal:
    if coupon.tipo == "porcentaje":
        value = subtotal * Decimal(str(coupon.valor)) / Decimal(100)
    else:
        value = Decimal(str(coupon.valor))
    return min(subtotal, value.quantize(CENT, rounding=ROUND_HALF_UP))


async def cotizar(session, tenant_id: int, items, id_cliente: int | None,
                  codigo_cupon: str | None, puntos: int | None,
                  fecha: datetime, canal: str) -> dict:
    """Quote sale items once; every sale/payment endpoint consumes this result."""
    if not items:
        raise ValueError("Debe enviar al menos un item")
    instant = fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)
    promotions = await _promotions(session, tenant_id, instant, canal)
    quantities: list[int] = []
    lines: list[dict] = []
    line_amounts: list[Decimal] = []
    subtotal = ZERO

    for item in items:
        product_id, quantity = _line_item(item)
        if quantity <= 0:
            raise ValueError("cantidad debe ser > 0")
        product = await session.get(Producto, product_id)
        if product is None or product.idEmpresa != tenant_id:
            raise ValueError(f"Producto {product_id} inexistente")
        price = _money(product.venta)
        amount = price * quantity
        subtotal += amount
        candidates = []
        for promotion in promotions:
            if await _promo_matches(session, promotion, product):
                candidates.append((_promotion_discount(promotion, price, quantity), promotion))
        discount, chosen = max(candidates, key=lambda pair: (pair[0], -pair[1].idPromocion)) if candidates else (ZERO, None)
        quantities.append(quantity)
        line_amounts.append(amount - discount)
        lines.append({
            "idProducto": product.idProducto,
            "cantidad": quantity,
            "precio_lista": float(price),
            "idPromocion": chosen.idPromocion if chosen else None,
            "descuento_promocion": float(discount),
            "precio_unitario": float(price),
            "_product": product,
        })

    subtotal = _money(subtotal)
    after_promotions_target = _money(sum(line_amounts, ZERO))
    promo_unit_prices = _price_lines(line_amounts, quantities)
    after_promotion_amounts = [price * quantity for price, quantity in zip(promo_unit_prices, quantities)]
    after_promotions = sum(after_promotion_amounts, ZERO)
    discount_promotions = _money(subtotal - after_promotions)
    for line, amount in zip(lines, after_promotion_amounts):
        line["descuento_promocion"] = float(_money(Decimal(str(line["precio_lista"])) * line["cantidad"] - amount))

    notices: list[str] = []
    coupon = None
    if canal == "online":
        coupon = await _cupon_valido(session, tenant_id, codigo_cupon, id_cliente, instant,
                                     after_promotions, notices)
    coupon_discount_target = _coupon_discount(coupon, after_promotions) if coupon else ZERO
    coupon_allocations = _allocate(coupon_discount_target, after_promotion_amounts)
    after_coupon_targets = [max(ZERO, amount - discount) for amount, discount in zip(after_promotion_amounts, coupon_allocations)]
    after_coupon_target = max(ZERO, after_promotions - coupon_discount_target)
    coupon_unit_prices = _price_lines(after_coupon_targets, quantities)
    after_coupon_amounts = [price * quantity for price, quantity in zip(coupon_unit_prices, quantities)]
    after_coupon = sum(after_coupon_amounts, ZERO)
    discount_coupon = _money(after_promotions - after_coupon)

    account = None
    if id_cliente is not None:
        account = await cuenta_bloqueada(session, tenant_id, id_cliente)
    balance = int(account.saldo) if account is not None else 0
    historical = int(account.acumulado_historico) if account is not None else 0
    account_level = nivel_puntos(historical)
    points_cap = max(0, int((after_coupon * Decimal("0.50") / POINT_VALUE).to_integral_value(rounding=ROUND_DOWN)))
    max_points = min(balance, points_cap)
    requested_points = max(0, int(puntos or 0)) if canal == "online" else 0
    points_used = min(requested_points, balance, max_points)
    if requested_points > points_used:
        notices.append("Los puntos solicitados superan el saldo o el límite de canje")
    points_discount_target = min(after_coupon, POINT_VALUE * points_used)
    points_allocations = _allocate(points_discount_target, after_coupon_amounts)
    final_targets = [max(ZERO, amount - discount) for amount, discount in zip(after_coupon_amounts, points_allocations)]
    final_target_total = max(ZERO, after_coupon - points_discount_target)
    final_prices = _price_lines(final_targets, quantities)
    final_amounts = [price * quantity for price, quantity in zip(final_prices, quantities)]
    total = _money(sum(final_amounts, ZERO))
    discount_points = _money(after_coupon - total)

    for line, price in zip(lines, final_prices):
        line["precio_unitario"] = float(price)
        line.pop("_product", None)
    points_earned = puntos_por_venta(total, historical) if id_cliente is not None else 0
    return {
        "lineas": lines,
        "subtotal": float(subtotal),
        "descuento_promociones": float(discount_promotions),
        "descuento_cupon": float(discount_coupon),
        "descuento_puntos": float(discount_points),
        "total": float(total),
        "idCupon": coupon.idCupon if coupon is not None else None,
        "puntos_canjeados": points_used,
        "puntos_a_ganar": points_earned,
        "avisos": notices,
        "cuenta": {"saldo": balance, "nivel": account_level["nivel"], "puntos_max_canjeables": max_points} if id_cliente is not None else None,
    }


async def registrar_uso_cupon(session, quote: dict, tenant_id: int, id_cliente: int | None,
                              id_venta: int, fecha: datetime) -> None:
    coupon_id = quote.get("idCupon")
    if coupon_id is None:
        return
    # The coupon row is the serialization point for global and per-client limits.
    result = await session.execute(
        select(Cupon).where(Cupon.idCupon == coupon_id, Cupon.idEmpresa == tenant_id).with_for_update()
    )
    coupon = result.scalar_one_or_none()
    if coupon is None or not coupon.activo or not _same_date(coupon.fecha_inicio, coupon.fecha_fin, fecha):
        raise ValueError("Cupón inválido o vencido")
    if id_cliente is not None and coupon.un_uso_por_cliente:
        prior = await session.execute(
            select(CuponUso.idCuponUso).where(
                CuponUso.idEmpresa == tenant_id,
                CuponUso.idCupon == coupon_id,
                CuponUso.idCliente == id_cliente,
            ).limit(1)
        )
        if prior.scalar_one_or_none() is not None:
            raise ValueError("Ya usaste este cupón")
    if coupon.usos_maximos is not None:
        count = await session.execute(
            select(func.count(CuponUso.idCuponUso)).where(
                CuponUso.idEmpresa == tenant_id, CuponUso.idCupon == coupon_id,
            )
        )
        if int(count.scalar_one() or 0) >= coupon.usos_maximos:
            raise ValueError("Cupón inválido o vencido")
    session.add(CuponUso(
        idEmpresa=tenant_id,
        idCupon=coupon_id,
        idVenta=id_venta,
        idCliente=id_cliente,
        fecha=fecha,
    ))


async def registrar_puntos_venta(session, quote: dict, tenant_id: int, id_cliente: int | None,
                                 id_venta: int, fecha: datetime) -> None:
    if id_cliente is None:
        return
    account = await cuenta_bloqueada(session, tenant_id, id_cliente, crear=True)
    redeemed = int(quote.get("puntos_canjeados", 0))
    earned = int(quote.get("puntos_a_ganar", 0))
    if account.saldo < redeemed:
        raise ValueError("Saldo de puntos insuficiente")
    if redeemed:
        account.saldo -= redeemed
        session.add(MovimientoPuntos(
            idEmpresa=tenant_id, idCliente=id_cliente, idVenta=id_venta,
            tipo="canjeado", puntos=-redeemed, fecha=fecha,
        ))
    if earned:
        account.saldo += earned
        account.acumulado_historico += earned
        session.add(MovimientoPuntos(
            idEmpresa=tenant_id, idCliente=id_cliente, idVenta=id_venta,
            tipo="ganado", puntos=earned, fecha=fecha,
        ))


async def aplicar_puntos_devolucion(session, tenant_id: int, sale, return_record,
                                    return_details, *, fecha: datetime | None = None) -> None:
    """Reverse earned and restore redeemed points proportionally on completed returns."""
    earned_total = int(getattr(sale, "puntos_ganados", 0) or 0)
    redeemed_total = int(getattr(sale, "puntos_canjeados", 0) or 0)
    if not earned_total and not redeemed_total:
        return
    from app.models import Devolucion, DevolucionDetalle, DetalleVenta

    # Lock before reading prior completed returns so concurrent refunds cannot
    # both calculate against the same stale ledger state.
    account = await cuenta_bloqueada(session, tenant_id, sale.idCliente, crear=True)
    all_detail_ids = await session.execute(select(DetalleVenta).where(DetalleVenta.idVenta == sale.idVenta))
    details_by_id = {detail.codigoVenta: detail for detail in all_detail_ids.scalars().all()}
    sale_value = _money(sale.total)
    if sale_value <= ZERO:
        return
    current_amount = ZERO
    for returned in return_details:
        original = details_by_id.get(returned.sale_item_id)
        if original is not None:
            current_amount += _money(original.precio_unitario) * int(returned.quantity)
    prior_rows = await session.execute(
        select(DevolucionDetalle, DetalleVenta)
        .join(DetalleVenta, DetalleVenta.codigoVenta == DevolucionDetalle.sale_item_id)
        .join(Devolucion, Devolucion.idDevolucion == DevolucionDetalle.return_id)
        .where(DetalleVenta.idVenta == sale.idVenta,
               DevolucionDetalle.return_id != return_record.idDevolucion,
               Devolucion.estado == "completed",
               Devolucion.idEmpresa == tenant_id)
    )
    prior_amount = sum(
        (_money(original.precio_unitario) * int(returned.quantity)
         for returned, original in prior_rows.all()), ZERO
    )
    prior_reversed = await session.execute(
        select(func.coalesce(func.sum(MovimientoPuntos.puntos), 0)).where(
            MovimientoPuntos.idVenta == sale.idVenta,
            MovimientoPuntos.tipo == "revertido",
            MovimientoPuntos.idEmpresa == tenant_id,
        )
    )
    prior_reverted = abs(int(prior_reversed.scalar_one() or 0))
    prior_refunded = await session.execute(
        select(func.coalesce(func.sum(MovimientoPuntos.puntos), 0)).where(
            MovimientoPuntos.idVenta == sale.idVenta,
            MovimientoPuntos.tipo == "devuelto",
            MovimientoPuntos.idEmpresa == tenant_id,
        )
    )
    prior_returned = int(prior_refunded.scalar_one() or 0)
    cumulative_ratio = min(Decimal(1), (prior_amount + current_amount) / sale_value)
    earned_target = floor(earned_total * cumulative_ratio)
    redeemed_target = floor(redeemed_total * cumulative_ratio)
    to_reverse = max(0, earned_target - prior_reverted)
    to_return = max(0, redeemed_target - prior_returned)
    if not to_reverse and not to_return:
        return
    now = fecha or datetime.now(timezone.utc)
    if to_reverse:
        balance_before = int(account.saldo)
        account.saldo = max(0, balance_before - to_reverse)
        clamp_note = "; saldo ajustado a cero" if to_reverse > balance_before else ""
        session.add(MovimientoPuntos(
            idEmpresa=tenant_id, idCliente=sale.idCliente, idVenta=sale.idVenta,
            tipo="revertido", puntos=-to_reverse, fecha=now,
            nota=f"Reversión por devolución {return_record.idDevolucion}{clamp_note}",
        ))
    if to_return:
        account.saldo += to_return
        session.add(MovimientoPuntos(
            idEmpresa=tenant_id, idCliente=sale.idCliente, idVenta=sale.idVenta,
            tipo="devuelto", puntos=to_return, fecha=now,
            nota=f"Devolución de puntos canjeados {return_record.idDevolucion}",
        ))
