from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MedidaProducto
from app.schemas.size_chart import SizeChartOut, SizeMeasurementOut


GENERIC_SIZE_RANGES = {
    "XS": (78, 85, 60, 67),
    "S": (86, 93, 68, 75),
    "M": (94, 101, 76, 83),
    "L": (102, 109, 84, 91),
    "XL": (110, 117, 92, 99),
    "XXL": (118, 125, 100, 107),
}
_SIZE_ORDER = {size: index for index, size in enumerate(GENERIC_SIZE_RANGES)}


def size_sort_key(size: str):
    if size in _SIZE_ORDER:
        return (0, _SIZE_ORDER[size], "")
    try:
        return (1, float(size), "")
    except ValueError:
        return (2, 0, size)


def generic_size_chart() -> SizeChartOut:
    return SizeChartOut(
        idProducto=0,
        fuente="generica",
        tallas=[SizeMeasurementOut(
            talla=size,
            pecho=(ranges[0] + ranges[1]) / 2,
            cintura=(ranges[2] + ranges[3]) / 2,
        ) for size, ranges in GENERIC_SIZE_RANGES.items()],
    )


async def get_size_chart(session: AsyncSession, idProducto: int, tenant_id: int) -> SizeChartOut:
    rows = (await session.execute(
        select(MedidaProducto)
        .where(MedidaProducto.idEmpresa == tenant_id, MedidaProducto.idProducto == idProducto)
    )).scalars().all()
    if not rows:
        chart = generic_size_chart()
        return chart.model_copy(update={"idProducto": idProducto})

    tallas = [SizeMeasurementOut(
        talla=row.talla,
        **{name: float(getattr(row, name)) if getattr(row, name) is not None else None
           for name in ("pecho", "largo", "hombros", "manga", "cintura", "cadera")},
    ) for row in rows]
    tallas.sort(key=lambda row: size_sort_key(row.talla))
    return SizeChartOut(idProducto=idProducto, fuente="propia", tallas=tallas)
