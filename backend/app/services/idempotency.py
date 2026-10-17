"""Persistence primitives for optional request idempotency."""
import hashlib
import json

from fastapi import HTTPException, Response
from sqlalchemy import select

from app.models import OperacionIdempotente


def body_hash(body) -> str:
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def replay_if_present(request, session, payload, response: Response, body):
    key = request.headers.get("Idempotency-Key")
    if not key:
        return None
    company = int(payload["empresa"])
    user = int(payload["sub"])
    digest = body_hash(body)
    row = (await session.execute(select(OperacionIdempotente).where(
        OperacionIdempotente.idEmpresa == company,
        OperacionIdempotente.idUser == user,
        OperacionIdempotente.clave == key,
    ))).scalar_one_or_none()
    if row:
        if row.hashBody != digest or row.metodo != request.method or row.ruta != request.url.path:
            raise HTTPException(status_code=409, detail={"code": "idempotency_key_reused"})
        response.headers["Idempotent-Replayed"] = "true"
        response.status_code = row.status
        return row.respuesta
    return key, digest


async def save_result(session, pending, payload, request, status_code, result):
    if pending is None:
        return
    key, digest = pending
    session.add(OperacionIdempotente(
        idEmpresa=int(payload["empresa"]), idUser=int(payload["sub"]), clave=key,
        metodo=request.method, ruta=request.url.path, hashBody=digest,
        status=status_code, respuesta=result,
    ))
