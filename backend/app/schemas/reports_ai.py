from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AIReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=1000)


class AIReportOut(BaseModel):
    summary: str
    columns: list[str]
    rows: list[list[Any]]
    tool_used: str
    period: dict[str, str | None]
