from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class CotizacionItem(BaseModel):
    idProducto: int = Field(gt=0)
    cantidad: int = Field(gt=0)


class CotizacionIn(BaseModel):
    items: list[CotizacionItem]
    idCliente: int | None = None
    codigoCupon: str | None = None
    puntos: int | None = Field(default=None, ge=0)


class PromocionIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    tipo: Literal["porcentaje", "monto_fijo", "nxm"]
    valor: float | None = None
    n: int | None = None
    m: int | None = None
    alcance: Literal["todos", "producto", "coleccion", "temporada", "tipo"] = "todos"
    alcance_ref: str | None = Field(default=None, max_length=120)
    fecha_inicio: datetime
    fecha_fin: datetime
    activa: bool = True

    @model_validator(mode="after")
    def validate_rule(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        if self.alcance != "todos" and not self.alcance_ref:
            raise ValueError("Debe indicar el alcance de la promoción")
        if self.tipo == "porcentaje":
            if self.valor is None or not 1 <= self.valor <= 90 or self.n is not None or self.m is not None:
                raise ValueError("El porcentaje debe estar entre 1 y 90")
        elif self.tipo == "monto_fijo":
            if self.valor is None or self.valor <= 0 or self.n is not None or self.m is not None:
                raise ValueError("El monto fijo debe ser mayor que cero")
        elif self.valor is not None or self.n is None or self.m is None or self.n <= self.m or self.m < 1:
            raise ValueError("La promoción 2x1 requiere n > m >= 1 y no admite valor")
        return self


class CuponIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=30)
    tipo: Literal["porcentaje", "monto_fijo"]
    valor: float = Field(gt=0)
    minimo_compra: float = Field(default=0, ge=0)
    fecha_inicio: datetime
    fecha_fin: datetime
    usos_maximos: int | None = Field(default=None, gt=0)
    un_uso_por_cliente: bool = True
    idCliente: int | None = None
    activo: bool = True

    @field_validator("codigo")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("El código del cupón es obligatorio")
        return normalized

    @model_validator(mode="after")
    def validate_dates_and_value(self):
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        if self.tipo == "porcentaje" and self.valor > 90:
            raise ValueError("El porcentaje del cupón debe estar entre 1 y 90")
        return self
