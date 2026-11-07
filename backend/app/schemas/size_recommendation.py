from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


FitResult = Literal["ajustada", "justa", "holgada"]
FeedbackResult = Literal["pequena", "bien", "grande"]


class SizeFitOut(BaseModel):
    talla: str
    ajuste: FitResult | None


class FitFeedbackStatsOut(BaseModel):
    total: int
    pequena: int
    bien: int
    grande: int
    nota: str | None


class SizeRecommendationOut(BaseModel):
    idProducto: int
    fuente: Literal["propia", "generica"]
    sin_medidas: bool
    medidas_cliente: dict[str, int | None]
    talla_recomendada: str | None
    ajuste: FitResult | None
    mensaje: str
    aviso_talla: str | None
    tallas: list[SizeFitOut]
    retroalimentacion: FitFeedbackStatsOut


class FitFeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resultado: FeedbackResult
    comentario: str | None = Field(default=None, max_length=255)

    @field_validator("comentario")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        comment = value.strip()
        return comment or None


class FitFeedbackSavedOut(BaseModel):
    idProducto: int
    talla: str
    resultado: FeedbackResult
    comentario: str | None
    fecha: datetime


class FitFeedbackMineOut(BaseModel):
    idProducto: int
    nombre: str
    talla: str
    imagen_url: str | None
    resultado: FeedbackResult | None
    fecha: datetime | None


class FitFeedbackSummaryOut(BaseModel):
    idProducto: int
    nombre: str
    talla: str | None
    total: int
    pequena: int
    bien: int
    grande: int
    alerta: bool
