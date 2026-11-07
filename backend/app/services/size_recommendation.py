from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RetroalimentacionAjuste
from app.schemas.size_chart import SizeChartOut
from app.schemas.size_recommendation import (
    FitFeedbackStatsOut,
    SizeFitOut,
    SizeRecommendationOut,
)
from app.services.size_chart import generic_size_chart, get_size_chart, size_sort_key


def _fit_for_size(size_row, fuente: str, medidas: dict[str, int | None]):
    statuses = []
    total_difference = 0.0
    for name in ("pecho", "cintura"):
        garment = getattr(size_row, name)
        body = medidas[name]
        if garment is None or body is None:
            continue
        difference = float(garment) - body
        total_difference += abs(difference)
        if fuente == "propia":
            statuses.append("ajustada" if difference < 0 else "justa" if difference <= 8 else "holgada")
        else:
            statuses.append("justa" if abs(difference) <= 4 else "ajustada" if difference < -4 else "holgada")
    if not statuses:
        return None, None
    if "ajustada" in statuses:
        return "ajustada", total_difference
    if "holgada" in statuses:
        return "holgada", total_difference
    return "justa", total_difference


def _recommended_size(scored_rows):
    comparable = [(row, fit, distance) for row, fit, distance in scored_rows if fit is not None]
    if not comparable:
        return None
    justa = [(row, fit, distance) for row, fit, distance in comparable if fit == "justa"]
    if justa:
        return min(justa, key=lambda item: (item[2], size_sort_key(item[0].talla)))
    not_adjusted = [(row, fit, distance) for row, fit, distance in comparable if fit != "ajustada"]
    if not_adjusted:
        return min(not_adjusted, key=lambda item: size_sort_key(item[0].talla))
    return max(comparable, key=lambda item: size_sort_key(item[0].talla))


async def get_feedback_counts(session: AsyncSession, idProducto: int, tenant_id: int) -> dict[str, int]:
    rows = (await session.execute(
        select(RetroalimentacionAjuste.resultado, func.count(RetroalimentacionAjuste.idRetro))
        .where(
            RetroalimentacionAjuste.idEmpresa == tenant_id,
            RetroalimentacionAjuste.idProducto == idProducto,
        )
        .group_by(RetroalimentacionAjuste.resultado)
    )).all()
    counts = {"total": 0, "pequena": 0, "bien": 0, "grande": 0}
    for result, count in rows:
        counts[result] = int(count)
        counts["total"] += int(count)
    return counts


def feedback_note(counts: dict[str, int]) -> str | None:
    total = counts["total"]
    if total < 3:
        return None
    for result, label in (("pequena", "pequeña"), ("grande", "grande")):
        count = counts[result]
        if count / total >= 0.6:
            percentage = round(count * 100 / total)
            return f"El {percentage}% de los clientes indica que esta prenda queda {label}"
    return None


async def recommend_size(
    session: AsyncSession,
    idProducto: int,
    tenant_id: int,
    medidas: dict[str, int | None],
) -> SizeRecommendationOut:
    chart = await get_size_chart(session, idProducto, tenant_id)
    scored = []
    for size in chart.tallas:
        fit, distance = _fit_for_size(size, chart.fuente, medidas)
        scored.append((size, fit, distance))
    recommendation = _recommended_size(scored)

    size_warning = None
    if chart.fuente == "propia" and recommendation is not None:
        habitual_rows = generic_size_chart().tallas
        habitual_scored = [
            (row, *_fit_for_size(row, "generica", medidas)) for row in habitual_rows
        ]
        habitual = _recommended_size(habitual_scored)
        if habitual is not None:
            recommended_size = recommendation[0].talla
            habitual_size = habitual[0].talla
            if size_sort_key(recommended_size) > size_sort_key(habitual_size):
                size_warning = (
                    f"Esta prenda talla pequeño; te recomendamos {recommended_size} "
                    f"en lugar de {habitual_size}"
                )
            elif size_sort_key(recommended_size) < size_sort_key(habitual_size):
                size_warning = (
                    f"Esta prenda talla grande; te recomendamos {recommended_size} "
                    f"en lugar de {habitual_size}"
                )

    counts = await get_feedback_counts(session, idProducto, tenant_id)
    note = feedback_note(counts)
    has_measures = any(medidas[name] is not None for name in ("pecho", "cintura"))
    if not has_measures:
        message = "Registra tus medidas en tu perfil para recibir una recomendación de talla"
        recommendation = None
    elif recommendation is None:
        message = "No hay medidas comparables para recomendar una talla"
    else:
        message = f"Te recomendamos la talla {recommendation[0].talla}; te quedará {recommendation[1]}"

    return SizeRecommendationOut(
        idProducto=idProducto,
        fuente=chart.fuente,
        sin_medidas=not has_measures,
        medidas_cliente=medidas,
        talla_recomendada=recommendation[0].talla if recommendation else None,
        ajuste=recommendation[1] if recommendation else None,
        mensaje=message,
        aviso_talla=size_warning,
        tallas=[SizeFitOut(talla=row.talla, ajuste=fit) for row, fit, _distance in scored],
        retroalimentacion=FitFeedbackStatsOut(**counts, nota=note),
    )
