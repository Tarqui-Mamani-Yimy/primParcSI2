from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, StrictStr, field_validator, model_validator


class AIReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=1000)


class AIReportOut(BaseModel):
    summary: str
    columns: list[str]
    rows: list[list[Any]]
    tool_used: str
    period: dict[str, str | None]


class AIReportExportPeriod(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_date: str | None = Field(default=None, alias="from")
    to: str | None = None

    @field_validator("from_date", "to")
    @classmethod
    def validate_iso_date(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            if date.fromisoformat(value).isoformat() != value:
                raise ValueError
        except (TypeError, ValueError) as exc:
            raise ValueError("Dates must use ISO format YYYY-MM-DD") from exc
        return value


ReportCell = Annotated[StrictStr, Field(max_length=500)] | StrictInt | StrictFloat | None


class AIReportExportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(max_length=4000)
    columns: list[Annotated[StrictStr, Field(max_length=100)]] = Field(min_length=1, max_length=20)
    rows: list[list[ReportCell]] = Field(max_length=5000)
    tool_used: Literal[
        "sales_by_period",
        "low_stock",
        "top_products",
        "returns",
        "top_products_by_branch",
        "sales_period_comparison",
        "sales_by_collection",
        "top_customers",
    ]
    period: AIReportExportPeriod

    @model_validator(mode="after")
    def validate_row_widths(self):
        if any(len(row) != len(self.columns) for row in self.rows):
            raise ValueError("Each report row must match the number of columns")
        return self
