"""Gemini orchestration for reports backed only by fixed tenant-scoped tools."""

from datetime import date
from decimal import Decimal

from sqlalchemy import String, and_, case, cast, func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    Cliente, Colecciones, CuentaPuntos, Devolucion, DevolucionDetalle,
    DetalleVenta, Inventario, Movimiento, Producto, Reserva, Sucursal,
    Temporada, Venta,
)
from app.routers.dashboard import UMBRAL_STOCK_BAJO, top_productos
from app.routers.reports import _consultar_inventario, _consultar_ventas
from app.security import get_plan_features
from app.schemas.reports_ai import AIReportOut
from app.services.pricing import nivel_puntos

try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types
except ImportError:  # pragma: no cover - guarded by gemini_configurado
    genai = None
    genai_errors = None
    types = None

settings = get_settings()
MODEL = settings.GEMINI_MODEL
MAX_TOOL_TURNS = 4


class GeminiNoConfigurado(RuntimeError):
    """The Gemini client or API key is unavailable."""


class GeminiHerramientaInvalida(RuntimeError):
    """Gemini requested a tool or arguments outside the fixed report contract."""


class GeminiReporteError(RuntimeError):
    """Gemini could not complete a report within the bounded tool loop."""


def gemini_configurado() -> bool:
    return genai is not None and bool(settings.GEMINI_API_KEY)


def _client():
    if not gemini_configurado():
        raise GeminiNoConfigurado("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _declaraciones_herramientas():
    return [
        types.FunctionDeclaration(
            name="sales_by_period",
            description="Sales totals grouped by product and branch, optionally filtered by dates, branch, and product.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "branch_id": {"type": "integer", "minimum": 1},
                    "product_id": {"type": "integer", "minimum": 1},
                },
            },
        ),
        types.FunctionDeclaration(
            name="low_stock",
            description="Inventory rows below the configured low-stock threshold, optionally filtered by branch or product.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "branch_id": {"type": "integer", "minimum": 1},
                    "product_id": {"type": "integer", "minimum": 1},
                },
            },
        ),
        types.FunctionDeclaration(
            name="top_products",
            description="Top selling products for an optional date range, ranked by sales amount.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                },
            },
        ),
        types.FunctionDeclaration(
            name="returns",
            description="Returns and exchanges for an optional date range.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                },
            },
        ),
        types.FunctionDeclaration(
            name="top_products_by_branch",
            description="Top selling products ranked independently inside each branch, by sales amount. Choose this for requests asking for rankings or best-selling products per branch/sucursal.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "branch_id": {"type": "integer", "minimum": 1},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                },
            },
        ),
        types.FunctionDeclaration(
            name="sales_period_comparison",
            description="Compares total sales amount between two explicit date ranges, grouped by branch. Select this when asked to compare a current and previous period or calculate branch growth percentages.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "current_start": {"type": "string", "format": "date"},
                    "current_end": {"type": "string", "format": "date"},
                    "previous_start": {"type": "string", "format": "date"},
                    "previous_end": {"type": "string", "format": "date"},
                    "branch_id": {"type": "integer", "minimum": 1},
                },
            },
        ),
        types.FunctionDeclaration(
            name="sales_by_collection",
            description="Aggregates sold quantity and amount by collection or season, including each group's percentage of total sales. Choose this for best-selling collections or seasons.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "group_by": {"type": "string", "enum": ["coleccion", "temporada"]},
                },
            },
        ),
        types.FunctionDeclaration(
            name="top_customers",
            description="Ranks customers by total sale value and reports purchase count and loyalty tier/available points. Choose this when asked for best or top customers.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                },
            },
        ),
    ]


def _arguments(name: str, args: dict) -> dict:
    allowed = {
        "sales_by_period": {"start_date", "end_date", "branch_id", "product_id"},
        "low_stock": {"branch_id", "product_id"},
        "top_products": {"start_date", "end_date", "limit"},
        "returns": {"start_date", "end_date"},
        "top_products_by_branch": {"start_date", "end_date", "branch_id", "limit"},
        "sales_period_comparison": {
            "current_start", "current_end", "previous_start", "previous_end", "branch_id",
        },
        "sales_by_collection": {"start_date", "end_date", "group_by"},
        "top_customers": {"start_date", "end_date", "limit"},
    }
    if name not in allowed:
        raise GeminiHerramientaInvalida(f"Unknown report tool: {name}")
    if not isinstance(args, dict) or set(args) - allowed[name]:
        raise GeminiHerramientaInvalida(f"Invalid arguments for report tool: {name}")
    normalized = dict(args)
    if name in {"top_products", "top_products_by_branch", "top_customers"} and normalized.get("limit") is None:
        normalized["limit"] = 10 if name in {"top_products_by_branch", "top_customers"} else 5
    date_keys = (
        "start_date", "end_date", "current_start", "current_end", "previous_start", "previous_end",
    )
    for key in date_keys:
        if key in normalized and normalized[key] is not None:
            try:
                normalized[key] = date.fromisoformat(normalized[key])
            except (TypeError, ValueError) as exc:
                raise GeminiHerramientaInvalida(f"Invalid {key} for report tool: {name}") from exc
    for key in ("branch_id", "product_id", "limit"):
        value = normalized.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 1):
            raise GeminiHerramientaInvalida(f"Invalid {key} for report tool: {name}")
    if normalized.get("limit", 5) > 20:
        raise GeminiHerramientaInvalida("The top-products limit cannot exceed 20")
    if name == "sales_period_comparison":
        required_dates = ("current_start", "current_end", "previous_start", "previous_end")
        if any(normalized.get(key) is None for key in required_dates):
            raise GeminiHerramientaInvalida("All comparison dates are required")
        if normalized["current_start"] > normalized["current_end"]:
            raise GeminiHerramientaInvalida("Current period start cannot be after end")
        if normalized["previous_start"] > normalized["previous_end"]:
            raise GeminiHerramientaInvalida("Previous period start cannot be after end")
    if name == "sales_by_collection":
        normalized["group_by"] = normalized.get("group_by") or "coleccion"
        if normalized["group_by"] not in {"coleccion", "temporada"}:
            raise GeminiHerramientaInvalida("Invalid group_by for report tool: sales_by_collection")
    if normalized.get("start_date") and normalized.get("end_date") and normalized["start_date"] > normalized["end_date"]:
        raise GeminiHerramientaInvalida("Report start_date cannot be after end_date")
    return normalized


def _period(args: dict) -> dict[str, str | None]:
    return {
        "from": args["start_date"].isoformat() if args.get("start_date") else None,
        "to": args["end_date"].isoformat() if args.get("end_date") else None,
    }


def _number(value) -> int | float | str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


async def _execute_tool(session: AsyncSession, tenant_id: int, name: str, raw_args: dict) -> dict:
    args = _arguments(name, raw_args)
    period = _period(args)
    if name == "sales_by_period":
        rows = await _consultar_ventas(
            session,
            args.get("start_date"),
            args.get("end_date"),
            args.get("branch_id"),
            args.get("product_id"),
        )
        columns = ["Producto", "Sucursal", "Cantidad vendida", "Monto"]
        values = [[row["producto_nombre"], row["sucursal_nombre"], row["cantidad_vendida"], _number(row["monto"])] for row in rows]
    elif name == "low_stock":
        rows = await _consultar_inventario(session, args.get("branch_id"), args.get("product_id"))
        rows = [row for row in rows if row["cantidad_actual"] < UMBRAL_STOCK_BAJO]
        columns = ["Producto", "Sucursal", "Stock actual", "Stock reservado"]
        values = [[row["producto_nombre"], row["sucursal_nombre"], row["cantidad_actual"], row["cantidad_reservada"]] for row in rows]
    elif name == "top_products":
        result = await top_productos(
            fecha_desde=args.get("start_date"),
            fecha_hasta=args.get("end_date"),
            limit=args.get("limit", 5),
            session=session,
        )
        columns = ["Producto", "Monto", "Cantidad vendida"]
        values = [[row.producto_nombre, _number(row.monto), row.cantidad] for row in result.productos]
    elif name == "top_products_by_branch":
        values = await _top_products_by_branch(session, tenant_id, args)
        columns = ["Sucursal", "Ranking", "Producto", "Cantidad vendida", "Monto"]
    elif name == "sales_period_comparison":
        values = await _sales_period_comparison(session, tenant_id, args)
        columns = ["Sucursal", "Ventas periodo actual", "Ventas periodo anterior", "Diferencia", "Variacion %"]
        period = {"from": args["current_start"].isoformat(), "to": args["current_end"].isoformat()}
    elif name == "sales_by_collection":
        columns, values = await _sales_by_collection(session, tenant_id, args)
    elif name == "top_customers":
        values = await _top_customers(session, tenant_id, args)
        columns = ["Ranking", "Cliente", "Compras", "Total gastado", "Nivel", "Puntos disponibles"]
    else:
        statement = (
            select(
                Devolucion.idDevolucion,
                Devolucion.fecha,
                Devolucion.tipo,
                Devolucion.estado,
                Devolucion.montoReembolso,
                Devolucion.montoCobrado,
                func.coalesce(func.sum(DevolucionDetalle.quantity), 0).label("quantity"),
            )
            .outerjoin(
                DevolucionDetalle,
                (DevolucionDetalle.return_id == Devolucion.idDevolucion)
                & (DevolucionDetalle.idEmpresa == tenant_id),
            )
            .where(Devolucion.idEmpresa == tenant_id)
            .group_by(
                Devolucion.idDevolucion,
                Devolucion.fecha,
                Devolucion.tipo,
                Devolucion.estado,
                Devolucion.montoReembolso,
                Devolucion.montoCobrado,
            )
            .order_by(Devolucion.fecha.desc())
        )
        if args.get("start_date"):
            statement = statement.where(Devolucion.fecha >= args["start_date"])
        if args.get("end_date"):
            statement = statement.where(Devolucion.fecha < date.fromordinal(args["end_date"].toordinal() + 1))
        raw_rows = (await session.execute(statement)).all()
        columns = ["ID devolución", "Fecha", "Tipo", "Estado", "Monto reembolsado", "Monto cobrado", "Cantidad"]
        values = [
            [row.idDevolucion, row.fecha.isoformat(), row.tipo, row.estado,
             _number(row.montoReembolso), _number(row.montoCobrado), int(row.quantity)]
            for row in raw_rows
        ]
    return {"columns": columns, "rows": values, "period": period}


def _sales_with_branch_attribution(
    tenant_id: int,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    date_filter=None,
):
    """Return tenant-scoped sale lines and their actual branch attribution."""
    details = (
        select(
            DetalleVenta.codigoVenta.label("detail_id"),
            DetalleVenta.idProducto.label("product_id"),
            func.sum(DetalleVenta.cantidad).label("quantity"),
            func.sum(DetalleVenta.cantidad * DetalleVenta.precio_unitario).label("amount"),
            DetalleVenta.idVenta.label("sale_id"),
            DetalleVenta.codigoReserva.label("reservation_id"),
            Venta.fecha.label("sale_date"),
        )
        .join(Venta, (Venta.idVenta == DetalleVenta.idVenta) & (Venta.idEmpresa == tenant_id))
        .where(DetalleVenta.idEmpresa == tenant_id)
        .group_by(
            DetalleVenta.codigoVenta, DetalleVenta.idProducto, DetalleVenta.idVenta,
            DetalleVenta.codigoReserva, Venta.fecha,
        )
    )
    if start_date:
        details = details.where(Venta.fecha >= start_date)
    if end_date:
        details = details.where(Venta.fecha < date.fromordinal(end_date.toordinal() + 1))
    if date_filter is not None:
        details = details.where(date_filter)
    detail_rows = details.subquery()

    sale_number = cast(detail_rows.c.sale_id, String)
    movement_branch = (
        select(detail_rows.c.detail_id, Inventario.codigoSucursal.label("branch_id"))
        .select_from(detail_rows)
        .join(Movimiento, (Movimiento.idEmpresa == tenant_id) & (Movimiento.tipo == "venta") & (
            Movimiento.motivo == literal("Venta ") + sale_number
        ) | (
            (Movimiento.idEmpresa == tenant_id) & (Movimiento.tipo == "venta") &
            (Movimiento.motivo == literal("Offline sale ") + sale_number)
        ))
        .join(Inventario, (Inventario.idInv == Movimiento.idInv) &
              (Inventario.idEmpresa == tenant_id) & (Inventario.idProducto == detail_rows.c.product_id))
        .where(detail_rows.c.reservation_id.is_(None))
        .distinct()
    )
    reservation_branch = (
        select(detail_rows.c.detail_id, Reserva.codigoSucursal.label("branch_id"))
        .select_from(detail_rows)
        .join(Reserva, (Reserva.codigoReserva == detail_rows.c.reservation_id) &
              (Reserva.idEmpresa == tenant_id))
        .where(detail_rows.c.reservation_id.is_not(None))
    )
    attribution = union_all(movement_branch, reservation_branch).subquery()
    return detail_rows, attribution


async def _top_products_by_branch(session: AsyncSession, tenant_id: int, args: dict) -> list[list]:
    """Rank products by amount within each branch using the shared actual-branch mapping."""
    detail_rows, attribution = _sales_with_branch_attribution(
        tenant_id, start_date=args.get("start_date"), end_date=args.get("end_date")
    )
    branch_sales = (
        select(
            Sucursal.nombre.label("branch_name"), Sucursal.codigoSucursal.label("branch_id"),
            Producto.nombre.label("product_name"), detail_rows.c.product_id,
            func.sum(detail_rows.c.quantity).label("quantity"),
            func.sum(detail_rows.c.amount).label("amount"),
        )
        .select_from(attribution)
        .join(detail_rows, detail_rows.c.detail_id == attribution.c.detail_id)
        .join(Sucursal, (Sucursal.codigoSucursal == attribution.c.branch_id) & (Sucursal.idEmpresa == tenant_id))
        .join(Producto, (Producto.idProducto == detail_rows.c.product_id) & (Producto.idEmpresa == tenant_id))
        .group_by(Sucursal.nombre, Sucursal.codigoSucursal, Producto.nombre, detail_rows.c.product_id)
    )
    if args.get("branch_id"):
        branch_sales = branch_sales.where(Sucursal.codigoSucursal == args["branch_id"])
    aggregated = branch_sales.subquery()
    ranked = select(
        aggregated,
        func.row_number().over(
            partition_by=aggregated.c.branch_id,
            order_by=(aggregated.c.amount.desc(), aggregated.c.product_id),
        ).label("ranking"),
    ).subquery()
    statement = (
        select(ranked)
        .where(ranked.c.ranking <= args.get("limit", 10))
        .order_by(ranked.c.branch_name, ranked.c.ranking)
    )
    rows = (await session.execute(statement)).all()
    return [[row.branch_name, row.ranking, row.product_name, int(row.quantity), _number(row.amount)] for row in rows]


async def _sales_period_comparison(session: AsyncSession, tenant_id: int, args: dict) -> list[list]:
    current_start = args["current_start"]
    current_end = date.fromordinal(args["current_end"].toordinal() + 1)
    previous_start = args["previous_start"]
    previous_end = date.fromordinal(args["previous_end"].toordinal() + 1)
    current_period = and_(Venta.fecha >= current_start, Venta.fecha < current_end)
    previous_period = and_(Venta.fecha >= previous_start, Venta.fecha < previous_end)
    detail_rows, attribution = _sales_with_branch_attribution(
        tenant_id, date_filter=or_(current_period, previous_period)
    )
    current_amount = func.sum(case((
        and_(detail_rows.c.sale_date >= current_start, detail_rows.c.sale_date < current_end),
        detail_rows.c.amount,
    ), else_=0)).label("current_amount")
    previous_amount = func.sum(case((
        and_(detail_rows.c.sale_date >= previous_start, detail_rows.c.sale_date < previous_end),
        detail_rows.c.amount,
    ), else_=0)).label("previous_amount")
    statement = (
        select(Sucursal.nombre.label("branch_name"), current_amount, previous_amount)
        .select_from(attribution)
        .join(detail_rows, detail_rows.c.detail_id == attribution.c.detail_id)
        .join(Sucursal, (Sucursal.codigoSucursal == attribution.c.branch_id) & (Sucursal.idEmpresa == tenant_id))
        .group_by(Sucursal.codigoSucursal, Sucursal.nombre)
        .order_by(Sucursal.nombre, Sucursal.codigoSucursal)
    )
    if args.get("branch_id"):
        statement = statement.where(Sucursal.codigoSucursal == args["branch_id"])
    rows = (await session.execute(statement)).all()
    values = []
    for row in rows:
        current = Decimal(str(row.current_amount or 0))
        previous = Decimal(str(row.previous_amount or 0))
        difference = current - previous
        variation = round(float(difference * 100 / previous), 2) if previous else None
        values.append([
            row.branch_name, _number(current), _number(previous), _number(difference), variation,
        ])
    return values


async def _sales_by_collection(session: AsyncSession, tenant_id: int, args: dict) -> tuple[list[str], list[list]]:
    amount = func.sum(DetalleVenta.cantidad * DetalleVenta.precio_unitario).label("amount")
    quantity = func.sum(DetalleVenta.cantidad).label("quantity")
    if args["group_by"] == "coleccion":
        columns = ["Temporada", "Coleccion", "Cantidad vendida", "Monto", "% del total"]
        selected = [
            Temporada.nombreTemporada.label("season_name"),
            Colecciones.nombre_coleccion.label("collection_name"),
            quantity, amount, Temporada.idTemporada, Colecciones.idColeccion,
        ]
        group_columns = [Temporada.nombreTemporada, Colecciones.nombre_coleccion,
                         Temporada.idTemporada, Colecciones.idColeccion]
    else:
        columns = ["Temporada", "Cantidad vendida", "Monto", "% del total"]
        selected = [Temporada.nombreTemporada.label("season_name"), quantity, amount, Temporada.idTemporada]
        group_columns = [Temporada.nombreTemporada, Temporada.idTemporada]
    statement = (
        select(*selected)
        .select_from(Venta)
        .join(DetalleVenta, (DetalleVenta.idVenta == Venta.idVenta) & (DetalleVenta.idEmpresa == tenant_id))
        .join(Producto, (Producto.idProducto == DetalleVenta.idProducto) & (Producto.idEmpresa == tenant_id))
        .join(Colecciones, (Colecciones.idColeccion == Producto.idColeccion) & (Colecciones.idEmpresa == tenant_id))
        .join(Temporada, (Temporada.idTemporada == Colecciones.idTemporada) & (Temporada.idEmpresa == tenant_id))
        .where(Venta.idEmpresa == tenant_id)
        .group_by(*group_columns)
        .order_by(amount.desc(), Temporada.idTemporada)
    )
    if args.get("start_date"):
        statement = statement.where(Venta.fecha >= args["start_date"])
    if args.get("end_date"):
        statement = statement.where(Venta.fecha < date.fromordinal(args["end_date"].toordinal() + 1))
    rows = (await session.execute(statement)).all()
    total = sum((Decimal(str(row.amount or 0)) for row in rows), Decimal("0"))
    values = []
    for row in rows:
        row_amount = Decimal(str(row.amount or 0))
        share = round(float(row_amount * 100 / total), 2) if total else 0.0
        if args["group_by"] == "coleccion":
            values.append([
                row.season_name, row.collection_name, int(row.quantity), _number(row_amount), share,
            ])
        else:
            values.append([row.season_name, int(row.quantity), _number(row_amount), share])
    return columns, values


async def _top_customers(session: AsyncSession, tenant_id: int, args: dict) -> list[list]:
    customer_sales = (
        select(
            Cliente.idCliente.label("customer_id"),
            Cliente.nombre.label("customer_name"),
            func.count(Venta.idVenta).label("purchases"),
            func.sum(Venta.total).label("total_spent"),
        )
        .select_from(Cliente)
        .join(Venta, (Venta.idCliente == Cliente.idCliente) & (Venta.idEmpresa == tenant_id))
        .where(Cliente.idEmpresa == tenant_id)
        .group_by(Cliente.idCliente, Cliente.nombre)
    )
    if args.get("start_date"):
        customer_sales = customer_sales.where(Venta.fecha >= args["start_date"])
    if args.get("end_date"):
        customer_sales = customer_sales.where(Venta.fecha < date.fromordinal(args["end_date"].toordinal() + 1))
    customer_totals = customer_sales.subquery()
    loyalty_enabled = "fidelizacion" in await get_plan_features(session, tenant_id)
    statement = (
        select(
            customer_totals.c.customer_id,
            customer_totals.c.customer_name,
            customer_totals.c.purchases,
            customer_totals.c.total_spent,
            CuentaPuntos.saldo,
            CuentaPuntos.acumulado_historico,
        )
        .select_from(customer_totals)
        .outerjoin(CuentaPuntos, (CuentaPuntos.idCliente == customer_totals.c.customer_id) &
                   (CuentaPuntos.idEmpresa == tenant_id))
        .order_by(customer_totals.c.total_spent.desc(), customer_totals.c.customer_id)
        .limit(args.get("limit", 10))
    )
    rows = (await session.execute(statement)).all()
    values = []
    for rank, row in enumerate(rows, start=1):
        if loyalty_enabled:
            level = nivel_puntos(row.acumulado_historico or 0)["nivel"]
            points = int(row.saldo or 0)
        else:
            level, points = "No aplica", 0
        values.append([
            rank, row.customer_name, int(row.purchases), _number(row.total_spent), level, points,
        ])
    return values


async def generar_reporte(session: AsyncSession, tenant_id: int, prompt: str) -> AIReportOut:
    """Ask Gemini for one fixed report tool and summarize only its verified rows."""
    client = _client()
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
    config = types.GenerateContentConfig(
        system_instruction=(
            "You generate concise Spanish summaries for a clothing retailer. Choose exactly one of the fixed report tools. "
            "Never request SQL or invent, alter, or expose rows. Use the supplied rows as the only source of facts. "
            "Infer dates from the user's request and use ISO date strings. After receiving tool results, summarize them briefly. "
            f"Today is {date.today().isoformat()}; resolve relative periods such as 'last month' from this date."
        ),
        tools=[types.Tool(function_declarations=_declaraciones_herramientas())],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    tool_used = None
    result = None
    for _ in range(MAX_TOOL_TURNS):
        try:
            response = await client.aio.models.generate_content(model=MODEL, contents=contents, config=config)
        except genai_errors.APIError as exc:
            raise GeminiReporteError(f"Gemini request failed: {exc.code} {exc.status}") from exc
        calls = response.function_calls or []
        if not calls:
            if result is None:
                raise GeminiReporteError("Gemini did not select a report tool")
            summary = (response.text or "").strip()
            if not summary:
                raise GeminiReporteError("Gemini returned an empty report summary")
            return AIReportOut(
                summary=summary,
                columns=result["columns"],
                rows=result["rows"],
                tool_used=tool_used,
                period=result["period"],
            )
        if len(calls) != 1:
            raise GeminiHerramientaInvalida("Select one fixed report tool per request")
        call = calls[0]
        if tool_used is not None and call.name != tool_used:
            raise GeminiHerramientaInvalida("A report request cannot combine different report tools")
        tool_used = call.name
        result = await _execute_tool(session, tenant_id, tool_used, dict(call.args or {}))
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)
        contents.append(
            types.Content(
                role="tool",
                parts=[types.Part.from_function_response(name=tool_used, response=result)],
            )
        )
    raise GeminiReporteError("Gemini exceeded the fixed report tool-call limit")
