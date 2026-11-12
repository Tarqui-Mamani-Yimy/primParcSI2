from html import escape as escape_html
from xml.sax.saxutils import escape as escape_xml

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.schemas.reports_ai import AIReportExportIn, AIReportIn, AIReportOut
from app.security import require_feature, require_permiso
from app.services.reportes_ia_gemini import (
    GeminiHerramientaInvalida,
    GeminiNoConfigurado,
    GeminiReporteError,
    generar_reporte,
)
from app.services.transcripcion_groq import (
    TranscripcionError,
    TranscripcionNoConfigurada,
    transcribir_audio,
)

MAX_AUDIO_BYTES = 10 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"}

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    dependencies=[Depends(require_feature("reportes"))],
)


async def _generate_report(payload: AIReportIn, session: AsyncSession, auth: dict) -> AIReportOut:
    _require_admin(auth)
    try:
        return await generar_reporte(session, int(auth["empresa"]), payload.prompt)
    except GeminiNoConfigurado as exc:
        raise HTTPException(
            status_code=503,
            detail="Gemini no está configurado en este servidor. Configure GEMINI_API_KEY.",
        ) from exc
    except GeminiHerramientaInvalida as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "gemini_invalid_tool", "message": str(exc)},
        ) from exc
    except GeminiReporteError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "gemini_report_failed", "message": str(exc)},
        ) from exc


def _require_admin(auth: dict) -> None:
    if str(auth.get("rol", "")).strip().casefold() not in {"admin", "administrador"}:
        raise HTTPException(
            status_code=403,
            detail={"code": "admin_only", "message": "Solo Admin puede solicitar reportes generativos."},
        )


@router.post("/ai", response_model=AIReportOut,
             dependencies=[Depends(require_feature("ia"))])
async def create_ai_report(
    payload: AIReportIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    return await _generate_report(payload, session, auth)


@router.post(
    "/ai/csv",
    dependencies=[Depends(require_feature("ia")), Depends(require_feature("reportes_export"))],
)
async def create_ai_report_csv(
    payload: AIReportIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    from app.routers.reports import _report_rows_to_csv

    result = await _generate_report(payload, session, auth)
    csv_text = _report_rows_to_csv(result.columns, result.rows)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="reporte_ia.csv"'},
    )


def _report_period_text(period) -> str:
    return f"{period.from_date or 'No especificado'} — {period.to or 'No especificado'}"


@router.post(
    "/ai/pdf",
    dependencies=[Depends(require_feature("ia")), Depends(require_feature("reportes_export"))],
)
async def export_ai_report_pdf(
    payload: AIReportExportIn,
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    from app.routers.reports import _build_pdf_bytes

    _require_admin(auth)
    # Only the subtitle goes through reportlab's Paragraph markup parser, so only
    # it is escaped; Table cells are drawn as literal text and stay unescaped.
    period = escape_xml(_report_period_text(payload.period))
    summary = escape_xml(payload.summary)
    headers = list(payload.columns)
    rows = [["" if cell is None else str(cell) for cell in row] for row in payload.rows]
    pdf_bytes = _build_pdf_bytes(
        "Reporte generativo",
        f"Período: {period}<br/><br/>{summary}",
        headers,
        rows,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="reporte_ia.pdf"'},
    )


@router.post(
    "/ai/html",
    dependencies=[Depends(require_feature("ia")), Depends(require_feature("reportes_export"))],
)
async def export_ai_report_html(
    payload: AIReportExportIn,
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    _require_admin(auth)
    period = escape_html(_report_period_text(payload.period), quote=True)
    summary = escape_html(payload.summary, quote=True)
    headers = "".join(f"<th>{escape_html(column, quote=True)}</th>" for column in payload.columns)
    body_rows = "".join(
        "<tr>" + "".join(
            f"<td>{escape_html('' if cell is None else str(cell), quote=True)}</td>"
            for cell in row
        ) + "</tr>"
        for row in payload.rows
    )
    document = (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Reporte generativo</title><style>'
        'body{font-family:Arial,sans-serif;margin:2rem;color:#222}'
        'table{border-collapse:collapse;width:100%;margin-top:1rem}'
        'th,td{border:1px solid #bbb;padding:.5rem;text-align:left}'
        'th{background:#eee}pre{white-space:pre-wrap;font:inherit}'
        '</style></head><body><h1>Reporte generativo</h1>'
        f'<p><strong>Período:</strong> {period}</p><pre>{summary}</pre>'
        f'<table><thead><tr>{headers}</tr></thead><tbody>{body_rows}</tbody></table>'
        '</body></html>'
    )
    return Response(
        content=document,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="reporte_ia.html"'},
    )


@router.post("/ai/transcribe", dependencies=[Depends(require_feature("ia"))])
async def transcribe_ai_audio(
    audio: UploadFile = File(...),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    _require_admin(auth)
    content_type = (audio.content_type or "").split(";", 1)[0].strip().lower()
    if content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="El tipo de audio no es válido.")

    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="El archivo de audio está vacío.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="El archivo de audio supera el límite de 10 MB.")

    try:
        text = await transcribir_audio(audio_bytes, audio.filename or "audio", content_type)
    except TranscripcionNoConfigurada as exc:
        raise HTTPException(
            status_code=503,
            detail="La transcripción por voz no está configurada en este servidor. Configure GROQ_API_KEY.",
        ) from exc
    except TranscripcionError as exc:
        raise HTTPException(status_code=502, detail={"code": "transcription_failed"}) from exc

    return {"text": text}
