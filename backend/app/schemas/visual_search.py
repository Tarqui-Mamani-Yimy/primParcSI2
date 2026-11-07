from pydantic import BaseModel, Field


class VisualSearchItem(BaseModel):
    idProducto: int
    nombre: str
    talla: str | None = None
    color: str | None = None
    venta: float
    imagen_url: str | None = None
    similitud: float = Field(ge=0, le=1)
    stock_total: int


class VisualSearchOut(BaseModel):
    resultados: list[VisualSearchItem]
    indexados: int


class VisualReindexOut(BaseModel):
    indexados: int
    omitidos: int
    errores: int
