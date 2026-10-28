from collections import defaultdict
from datetime import date, datetime, time, timedelta
from math import ceil

import numpy as np
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sqlalchemy import String, and_, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Cliente,
    DetalleVenta,
    Inventario,
    Movimiento,
    Producto,
    Sucursal,
    Venta,
)

MIN_FORECAST_SALE_DAYS = 28
MIN_STOCKOUT_SALE_DAYS = 14
MIN_PRODUCT_TREND_WEEKS = 8
MIN_CUSTOMER_SEGMENTS = 3
HISTORY_DAYS = 180
STOCK_DEMAND_DAYS = 30


def _day(value: date | datetime) -> date:
    return value.date() if isinstance(value, datetime) else value


def _sales_statement(tenant_id: int, start: date, end: date, branch_id: int | None = None):
    statement = (
        select(
            Venta.idVenta,
            Venta.idCliente,
            Venta.fecha,
            DetalleVenta.idProducto,
            DetalleVenta.cantidad,
            DetalleVenta.precio_unitario,
            Producto.nombre.label("product_name"),
            Producto.talla.label("size"),
        )
        .select_from(Venta)
        .join(
            DetalleVenta,
            and_(
                DetalleVenta.idVenta == Venta.idVenta,
                DetalleVenta.idEmpresa == tenant_id,
            ),
        )
        .join(
            Producto,
            and_(Producto.idProducto == DetalleVenta.idProducto, Producto.idEmpresa == tenant_id),
        )
        .where(
            Venta.idEmpresa == tenant_id,
            Venta.fecha >= datetime.combine(start, time.min),
            Venta.fecha < datetime.combine(end, time.min),
        )
    )
    if branch_id is not None:
        statement = (
            statement.join(
                Movimiento,
                and_(
                    Movimiento.idEmpresa == tenant_id,
                    Movimiento.tipo == "venta",
                    Movimiento.motivo == ("Venta " + cast(Venta.idVenta, String)),
                ),
            )
            .join(
                Inventario,
                and_(
                    Inventario.idInv == Movimiento.idInv,
                    Inventario.idEmpresa == tenant_id,
                    Inventario.idProducto == DetalleVenta.idProducto,
                    Inventario.codigoSucursal == branch_id,
                ),
            )
            .join(
                Sucursal,
                and_(Sucursal.codigoSucursal == Inventario.codigoSucursal, Sucursal.idEmpresa == tenant_id),
            )
        )
    return statement.order_by(Venta.fecha, Venta.idVenta, DetalleVenta.idProducto)


async def _sales_rows(
    session: AsyncSession,
    tenant_id: int,
    start: date,
    end: date,
    branch_id: int | None = None,
):
    result = await session.execute(_sales_statement(tenant_id, start, end, branch_id))
    return result.all()


def _daily_history(rows, start: date, end: date) -> list[dict]:
    totals: dict[date, dict[str, float | int]] = defaultdict(lambda: {"amount": 0.0, "units": 0})
    for row in rows:
        sale_day = _day(row.fecha)
        totals[sale_day]["amount"] += float(row.cantidad * row.precio_unitario)
        totals[sale_day]["units"] += int(row.cantidad)
    return [
        {
            "date": start + timedelta(days=offset),
            "amount": round(float(totals[start + timedelta(days=offset)]["amount"]), 2),
            "units": int(totals[start + timedelta(days=offset)]["units"]),
        }
        for offset in range((end - start).days)
    ]


def _sales_features(day: date, index: int) -> list[float]:
    # Sunday is the reference day; the remaining weekday flags model weekly seasonality.
    return [float(index), *[float(day.weekday() == weekday) for weekday in range(6)]]


def proyectar_ventas(history: list[dict], days: int) -> tuple[list[dict], dict]:
    if len(history) < 2:
        return [], {"name": "LinearRegression + weekday seasonality", "mae": None}

    rows = sorted(history, key=lambda row: row["date"])
    start = rows[0]["date"]
    x = np.asarray([_sales_features(row["date"], (row["date"] - start).days) for row in rows])
    y = np.asarray([max(0.0, float(row["amount"])) for row in rows])
    estimator = LinearRegression().fit(x, y)
    residuals = y - estimator.predict(x)
    mae = float(np.mean(np.abs(residuals)))
    band = max(mae, float(np.quantile(np.abs(residuals), 0.95)))
    last_day = rows[-1]["date"]
    forecast = []
    for offset in range(1, days + 1):
        forecast_day = last_day + timedelta(days=offset)
        predicted = max(0.0, float(estimator.predict([_sales_features(forecast_day, (forecast_day - start).days)])[0]))
        amount = round(predicted, 2)
        lower = round(max(0.0, predicted - band), 2)
        upper = round(predicted + band, 2)
        forecast.append({"date": forecast_day, "amount": amount, "lower": lower, "upper": upper})
    return forecast, {"name": "LinearRegression + weekday seasonality", "mae": round(mae, 2)}


async def ventas_futuras(
    session: AsyncSession,
    tenant_id: int,
    days: int = 30,
    branch_id: int | None = None,
) -> dict:
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)
    rows = await _sales_rows(session, tenant_id, start, today, branch_id)
    history = _daily_history(rows, start, today)
    active_days = sum(point["units"] > 0 for point in history)
    if active_days < MIN_FORECAST_SALE_DAYS:
        return {
            "insufficient_data": True,
            "history": history,
            "forecast": [],
            "total_forecast_amount": 0.0,
            "model": {"name": "LinearRegression + weekday seasonality", "mae": None},
        }
    forecast, model = proyectar_ventas(history, days)
    return {
        "insufficient_data": False,
        "history": history,
        "forecast": forecast,
        "total_forecast_amount": round(sum(row["amount"] for row in forecast), 2),
        "model": model,
    }


async def _stock_rows(session: AsyncSession, tenant_id: int, branch_id: int | None):
    statement = (
        select(
            Inventario.idProducto,
            Producto.nombre.label("product_name"),
            Producto.talla.label("size"),
            Inventario.codigoSucursal,
            Sucursal.nombre.label("branch_name"),
            Inventario.cantidad_actual,
        )
        .select_from(Inventario)
        .join(Producto, and_(Producto.idProducto == Inventario.idProducto, Producto.idEmpresa == tenant_id))
        .join(
            Sucursal,
            and_(Sucursal.codigoSucursal == Inventario.codigoSucursal, Sucursal.idEmpresa == tenant_id),
        )
        .where(Inventario.idEmpresa == tenant_id)
    )
    if branch_id is not None:
        statement = statement.where(Inventario.codigoSucursal == branch_id)
    return (await session.execute(statement.order_by(Producto.nombre, Sucursal.nombre))).all()


async def _stock_demand_rows(session: AsyncSession, tenant_id: int, start: date, end: date, branch_id: int | None):
    statement = (
        select(
            Inventario.idProducto,
            Inventario.codigoSucursal,
            Venta.fecha,
            (-Movimiento.cantidad).label("units"),
        )
        .select_from(Movimiento)
        .join(
            Inventario,
            and_(Inventario.idInv == Movimiento.idInv, Inventario.idEmpresa == tenant_id),
        )
        .join(
            Sucursal,
            and_(Sucursal.codigoSucursal == Inventario.codigoSucursal, Sucursal.idEmpresa == tenant_id),
        )
        .join(
            Venta,
            and_(
                Movimiento.motivo == ("Venta " + cast(Venta.idVenta, String)),
                Venta.idEmpresa == tenant_id,
                Venta.fecha >= datetime.combine(start, time.min),
                Venta.fecha < datetime.combine(end, time.min),
            ),
        )
        .where(
            Movimiento.idEmpresa == tenant_id,
            Movimiento.tipo == "venta",
            Movimiento.cantidad < 0,
        )
    )
    if branch_id is not None:
        statement = statement.where(Inventario.codigoSucursal == branch_id)
    return (await session.execute(statement)).all()


async def riesgo_quiebre_stock(session: AsyncSession, tenant_id: int, branch_id: int | None = None) -> dict:
    today = date.today()
    demand_start = today - timedelta(days=STOCK_DEMAND_DAYS)
    inventory = await _stock_rows(session, tenant_id, branch_id)
    sales = await _stock_demand_rows(session, tenant_id, today - timedelta(days=HISTORY_DAYS), today, branch_id)
    active_days = {_day(row.fecha) for row in sales}
    if len(active_days) < MIN_STOCKOUT_SALE_DAYS or not inventory:
        return {"insufficient_data": True, "items": []}

    demand = defaultdict(int)
    for row in sales:
        if _day(row.fecha) >= demand_start:
            demand[(row.idProducto, row.codigoSucursal)] += int(row.units)
    items = []
    for row in inventory:
        units = demand[(row.idProducto, row.codigoSucursal)]
        daily_demand = units / STOCK_DEMAND_DAYS
        current_stock = int(row.cantidad_actual)
        days_to_stockout = round(current_stock / daily_demand, 2) if daily_demand > 0 else None
        items.append(
            {
                "product_id": int(row.idProducto),
                "product_name": row.product_name,
                "talla": row.size,
                "branch_id": int(row.codigoSucursal),
                "branch_name": row.branch_name,
                "current_stock": current_stock,
                "daily_demand": round(daily_demand, 2),
                "days_to_stockout": days_to_stockout,
                "suggested_restock": max(0, ceil(daily_demand * STOCK_DEMAND_DAYS - current_stock)),
            }
        )
    items.sort(
        key=lambda row: (
            row["days_to_stockout"] is None,
            row["days_to_stockout"] if row["days_to_stockout"] is not None else float("inf"),
        )
    )
    return {"insufficient_data": False, "items": items}


def _weekly_slope(values: list[int]) -> float:
    if len(values) < 2:
        return 0.0
    x = np.arange(len(values), dtype=float).reshape(-1, 1)
    return float(LinearRegression().fit(x, np.asarray(values, dtype=float)).coef_[0])


def clasificar_tendencia_semanal(values: list[int]) -> str:
    slope = _weekly_slope(values)
    tolerance = max(0.05, (float(np.mean(values)) if values else 0.0) * 0.02)
    if slope > tolerance:
        return "creciendo"
    if slope < -tolerance:
        return "cayendo"
    return "estable"


async def tendencias_productos(session: AsyncSession, tenant_id: int) -> dict:
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)
    statement = (
        select(
            Producto.idProducto,
            Producto.nombre,
            Venta.fecha,
            DetalleVenta.cantidad,
        )
        .select_from(Venta)
        .join(
            DetalleVenta,
            and_(DetalleVenta.idVenta == Venta.idVenta, DetalleVenta.idEmpresa == tenant_id),
        )
        .join(Producto, and_(Producto.idProducto == DetalleVenta.idProducto, Producto.idEmpresa == tenant_id))
        .where(
            Venta.idEmpresa == tenant_id,
            Venta.fecha >= datetime.combine(start, time.min),
            Venta.fecha < datetime.combine(today, time.min),
        )
        .order_by(Venta.fecha)
    )
    rows = (await session.execute(statement)).all()
    weeks_with_sales = {_day(row.fecha) - timedelta(days=_day(row.fecha).weekday()) for row in rows}
    if len(weeks_with_sales) < MIN_PRODUCT_TREND_WEEKS:
        return {"insufficient_data": True, "items": []}

    products: dict[int, dict] = {}
    for row in rows:
        product_id = int(row.idProducto)
        sale_day = _day(row.fecha)
        week = sale_day - timedelta(days=sale_day.weekday())
        product = products.setdefault(
            product_id,
            {"product_name": row.nombre, "weekly": defaultdict(int), "last": 0, "previous": 0},
        )
        product["weekly"][week] += int(row.cantidad)
        if sale_day >= today - timedelta(days=30):
            product["last"] += int(row.cantidad)
        elif sale_day >= today - timedelta(days=60):
            product["previous"] += int(row.cantidad)

    first_week = min(weeks_with_sales)
    last_week = today - timedelta(days=today.weekday())
    all_weeks = [first_week + timedelta(weeks=index) for index in range(((last_week - first_week).days // 7) + 1)]
    items = []
    for product_id, product in products.items():
        weekly_values = [product["weekly"].get(week, 0) for week in all_weeks]
        slope = _weekly_slope(weekly_values)
        items.append(
            {
                "product_id": product_id,
                "product_name": product["product_name"],
                "trend": clasificar_tendencia_semanal(weekly_values),
                "slope": round(slope, 4),
                "units_last_30": product["last"],
                "units_prev_30": product["previous"],
            }
        )
    items.sort(key=lambda row: row["product_name"])
    return {"insufficient_data": False, "items": items}


async def segmentar_clientes(session: AsyncSession, tenant_id: int) -> dict:
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)
    statement = (
        select(
            Venta.idVenta,
            Venta.idCliente,
            Venta.fecha,
            DetalleVenta.cantidad,
            DetalleVenta.precio_unitario,
            Cliente.nombre,
        )
        .select_from(Venta)
        .join(
            DetalleVenta,
            and_(DetalleVenta.idVenta == Venta.idVenta, DetalleVenta.idEmpresa == tenant_id),
        )
        .join(Cliente, and_(Cliente.idCliente == Venta.idCliente, Cliente.idEmpresa == tenant_id))
        .where(
            Venta.idEmpresa == tenant_id,
            Venta.fecha >= datetime.combine(start, time.min),
            Venta.fecha < datetime.combine(today, time.min),
        )
    )
    rows = (await session.execute(statement)).all()
    customer_data: dict[int, dict] = {}
    for row in rows:
        customer_id = int(row.idCliente)
        customer = customer_data.setdefault(
            customer_id,
            {"name": row.nombre, "sales": set(), "last_sale": _day(row.fecha), "monetary": 0.0},
        )
        customer["sales"].add(int(row.idVenta))
        customer["last_sale"] = max(customer["last_sale"], _day(row.fecha))
        customer["monetary"] += float(row.cantidad * row.precio_unitario)

    if len(customer_data) < MIN_CUSTOMER_SEGMENTS:
        return {"insufficient_data": True, "segments": [], "customers": []}

    customer_ids = sorted(customer_data)
    rfm = np.asarray(
        [
            [
                (today - customer_data[customer_id]["last_sale"]).days,
                len(customer_data[customer_id]["sales"]),
                customer_data[customer_id]["monetary"],
            ]
            for customer_id in customer_ids
        ],
        dtype=float,
    )
    if len(np.unique(rfm, axis=0)) < MIN_CUSTOMER_SEGMENTS:
        return {"insufficient_data": True, "segments": [], "customers": []}

    scaled = StandardScaler().fit_transform(rfm)
    clustering = KMeans(n_clusters=MIN_CUSTOMER_SEGMENTS, random_state=42, n_init=10).fit(scaled)
    centroids = clustering.cluster_centers_
    ranked_clusters = sorted(
        range(MIN_CUSTOMER_SEGMENTS),
        key=lambda index: (-centroids[index][0] + centroids[index][1] + centroids[index][2]),
        reverse=True,
    )
    labels = ["Frecuentes", "Ocasionales", "En riesgo"]
    segment_names = {
        cluster: (f"segment_{rank + 1}", labels[rank])
        for rank, cluster in enumerate(ranked_clusters)
    }

    grouped: dict[int, list[int]] = defaultdict(list)
    customers = []
    for row_index, customer_id in enumerate(customer_ids):
        cluster = int(clustering.labels_[row_index])
        segment, _label = segment_names[cluster]
        customer = customer_data[customer_id]
        recency = (today - customer["last_sale"]).days
        frequency = len(customer["sales"])
        monetary = round(customer["monetary"], 2)
        grouped[cluster].append(customer_id)
        customers.append(
            {
                "customer_id": customer_id,
                "name": customer["name"],
                "segment": segment,
                "recency_days": recency,
                "frequency": frequency,
                "monetary": monetary,
            }
        )

    segments = []
    for cluster in ranked_clusters:
        member_ids = grouped.get(cluster, [])
        if not member_ids:
            continue
        segment, label = segment_names[cluster]
        segments.append(
            {
                "segment": segment,
                "label": label,
                "customers": len(member_ids),
                "avg_recency_days": round(float(np.mean([(today - customer_data[cid]["last_sale"]).days for cid in member_ids])), 2),
                "avg_frequency": round(float(np.mean([len(customer_data[cid]["sales"]) for cid in member_ids])), 2),
                "avg_amount": round(float(np.mean([customer_data[cid]["monetary"] for cid in member_ids])), 2),
            }
        )
    return {"insufficient_data": False, "segments": segments, "customers": customers}
