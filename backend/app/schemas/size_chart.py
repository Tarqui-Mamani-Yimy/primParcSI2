from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


MEASUREMENT_FIELDS = ("pecho", "largo", "hombros", "manga", "cintura", "cadera")


class SizeMeasurementIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    talla: str
    pecho: Decimal | None = None
    largo: Decimal | None = None
    hombros: Decimal | None = None
    manga: Decimal | None = None
    cintura: Decimal | None = None
    cadera: Decimal | None = None

    @field_validator("talla")
    @classmethod
    def normalize_size(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("La talla no puede estar vacía")
        if len(normalized) > 20:
            raise ValueError("La talla no puede superar 20 caracteres")
        return normalized

    @field_validator(*MEASUREMENT_FIELDS, mode="before")
    @classmethod
    def validate_measurement(cls, value):
        if value is None:
            return None
        try:
            number = Decimal(str(value))
        except Exception as exc:
            raise ValueError("La medida debe ser un número entre 1 y 300 cm") from exc
        if not number.is_finite() or not Decimal("1") <= number <= Decimal("300"):
            raise ValueError("Cada medida debe estar entre 1 y 300 cm")
        return number

    @model_validator(mode="after")
    def require_measure(self):
        if all(getattr(self, field) is None for field in MEASUREMENT_FIELDS):
            raise ValueError("Cada talla debe incluir al menos una medida")
        return self


class SizeChartReplaceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tallas: list[SizeMeasurementIn]

    @model_validator(mode="after")
    def require_unique_sizes(self):
        sizes = [item.talla for item in self.tallas]
        if len(sizes) != len(set(sizes)):
            raise ValueError("Las tallas no pueden repetirse")
        return self


class SizeMeasurementOut(BaseModel):
    talla: str
    pecho: float | None = None
    largo: float | None = None
    hombros: float | None = None
    manga: float | None = None
    cintura: float | None = None
    cadera: float | None = None


class SizeChartOut(BaseModel):
    idProducto: int
    fuente: str
    tallas: list[SizeMeasurementOut]
