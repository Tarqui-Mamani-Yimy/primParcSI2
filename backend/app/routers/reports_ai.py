from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_tenant_db
from app.schemas.reports_ai import AIReportIn, AIReportOut
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


@router.post("/ai", response_model=AIReportOut)
async def create_ai_report(
    payload: AIReportIn,
    session: AsyncSession = Depends(get_tenant_db),
    auth: dict = Depends(require_permiso("reporte.ver")),
):
    return await _generate_report(payload, session, auth)


@router.post(
    "/ai/csv",
    dependencies=[Depends(require_feature("reportes_export"))],
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


@router.post("/ai/transcribe")
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
