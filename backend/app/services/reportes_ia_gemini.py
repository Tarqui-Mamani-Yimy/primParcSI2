"""Gemini orchestration for reports backed only by fixed tenant-scoped tools."""

from datetime import date
from decimal import Decimal

from sqlalchemy import String, cast, func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    Devolucion, DevolucionDetalle, DetalleVenta, Inventario, Movimiento,
    Producto, Reserva, Sucursal, Venta,
)
from app.routers.dashboard import UMBRAL_STOCK_BAJO, top_productos
from app.routers.reports import _consultar_inventario, _consultar_ventas
from app.schemas.reports_ai import AIReportOut

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
    ]


def _arguments(name: str, args: dict) -> dict:
    allowed = {
        "sales_by_period": {"start_date", "end_date", "branch_id", "product_id"},
        "low_stock": {"branch_id", "product_id"},
        "top_products": {"start_date", "end_date", "limit"},
        "returns": {"start_date", "end_date"},
        "top_products_by_branch": {"start_date", "end_date", "branch_id", "limit"},
    }
    if name not in allowed:
        raise GeminiHerramientaInvalida(f"Unknown report tool: {name}")
    if not isinstance(args, dict) or set(args) - allowed[name]:
        raise GeminiHerramientaInvalida(f"Invalid arguments for report tool: {name}")
    normalized = dict(args)
    if name in {"top_products", "top_products_by_branch"} and normalized.get("limit") is None:
        normalized["limit"] = 10 if name == "top_products_by_branch" else 5
    for key in ("start_date", "end_date"):
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


async def _top_products_by_branch(session: AsyncSession, tenant_id: int, args: dict) -> list[list]:
    """Rank products by amount within each branch using the sale's actual inventory movement."""
    details = (
        select(
            DetalleVenta.codigoVenta.label("detail_id"),
            DetalleVenta.idProducto.label("product_id"),
            func.sum(DetalleVenta.cantidad).label("quantity"),
            func.sum(DetalleVenta.cantidad * DetalleVenta.precio_unitario).label("amount"),
            DetalleVenta.idVenta.label("sale_id"),
            DetalleVenta.codigoReserva.label("reservation_id"),
        )
        .join(Venta, (Venta.idVenta == DetalleVenta.idVenta) & (Venta.idEmpresa == tenant_id))
        .where(DetalleVenta.idEmpresa == tenant_id)
        .group_by(
            DetalleVenta.codigoVenta, DetalleVenta.idProducto, DetalleVenta.idVenta,
            DetalleVenta.codigoReserva,
        )
    )
    if args.get("start_date"):
        details = details.where(Venta.fecha >= args["start_date"])
    if args.get("end_date"):
        details = details.where(Venta.fecha < date.fromordinal(args["end_date"].toordinal() + 1))
    detail_rows = details.subquery()

    sale_number = cast(detail_rows.c.sale_id, String)
    movement_branch = (
        select(detail_rows.c.detail_id, Inventario.codigoSucursal.label("branch_id"))
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
        .join(Reserva, (Reserva.codigoReserva == detail_rows.c.reservation_id) &
              (Reserva.idEmpresa == tenant_id))
        .where(detail_rows.c.reservation_id.is_not(None))
    )
    attribution = union_all(movement_branch, reservation_branch).subquery()
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
