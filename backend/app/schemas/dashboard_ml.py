from datetime import date
from typing import Literal

from pydantic import BaseModel


class DailySalesPoint(BaseModel):
    date: date
    amount: float
    units: int


class SalesForecastPoint(BaseModel):
    date: date
    amount: float
    lower: float
    upper: float


class SalesForecastModel(BaseModel):
    name: str
    mae: float | None


class SalesForecastOut(BaseModel):
    insufficient_data: bool
    history: list[DailySalesPoint]
    forecast: list[SalesForecastPoint]
    total_forecast_amount: float
    model: SalesForecastModel


class StockoutRiskItem(BaseModel):
    product_id: int
    product_name: str
    talla: str | None
    branch_id: int
    branch_name: str
    current_stock: int
    daily_demand: float
    days_to_stockout: float | None
    suggested_restock: int


class StockoutRiskOut(BaseModel):
    insufficient_data: bool
    items: list[StockoutRiskItem]


class ProductTrendItem(BaseModel):
    product_id: int
    product_name: str
    trend: Literal["creciendo", "estable", "cayendo"]
    slope: float
    units_last_30: int
    units_prev_30: int


class ProductTrendsOut(BaseModel):
    insufficient_data: bool
    items: list[ProductTrendItem]


class CustomerSegmentSummary(BaseModel):
    segment: str
    label: str
    customers: int
    avg_recency_days: float
    avg_frequency: float
    avg_amount: float


class CustomerSegmentCustomer(BaseModel):
    customer_id: int
    name: str
    segment: str
    recency_days: int
    frequency: int
    monetary: float


class CustomerSegmentsOut(BaseModel):
    insufficient_data: bool
    segments: list[CustomerSegmentSummary]
    customers: list[CustomerSegmentCustomer]
