from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bitacora, Rol, Usuario
from app.schemas.team import ActivateAccountResponse, AuditLogOut, TeamMemberOut
from app.security import require_permiso
from app.services.usuarios import build_user_claims

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("", response_model=list[TeamMemberOut])
async def list_team(session: AsyncSession = Depends(get_db),
                    _=Depends(require_permiso("equipo.ver"))):
    roles_staff = (
        await session.execute(
            select(Rol).where(
                Rol.nombreRol.in_(["Administrador", "Encargado de Sucursal", "Cajero"])
            )
        )
    ).scalars().all()
    codigos_staff = [r.codigoRol for r in roles_staff]
    if not codigos_staff:
        return []

    usuarios = (
        await session.execute(
            select(Usuario).where(Usuario.codigoRol.in_(codigos_staff))
        )
    ).scalars().all()

    resultado = []
    for u in usuarios:
        claims = await build_user_claims(session, u)
        resultado.append(
            TeamMemberOut(
                idUser=u.idUser,
                nombre=u.nombre,
                correo=u.correo,
                rol=claims["rol"],
                permisos=claims["permisos"],
            )
        )
    return resultado


@router.get("/audit-log", response_model=list[AuditLogOut])
async def audit_log(
    idUser: int | None = None,
    fecha: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("equipo.ver")),
):
    stmt = (
        select(Bitacora, Usuario)
        .join(Usuario, Usuario.idUser == Bitacora.idUser)
        .order_by(Bitacora.idBitacora.desc())
        .limit(limit)
    )
    if idUser is not None:
        stmt = stmt.where(Bitacora.idUser == idUser).order_by(Bitacora.idBitacora.desc()).limit(limit)
    if fecha:
        stmt = (
            select(Bitacora, Usuario)
            .join(Usuario, Usuario.idUser == Bitacora.idUser)
            .where(Bitacora.fecha == fecha)
            .order_by(Bitacora.idBitacora.desc())
            .limit(limit)
        )

    rows = (await session.execute(stmt)).all()
    return [
        AuditLogOut(
            idBitacora=b.idBitacora,
            accion=b.accion,
            hora=b.hora,
            fecha=b.fecha,
            ip=str(b.ip),
            idUser=b.idUser,
            usuario_nombre=u.nombre,
        )
        for b, u in rows
    ]


@router.patch("/{idUser}/activate", response_model=ActivateAccountResponse)
async def activate_account(
    idUser: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("usuario.admin")),
):
    usuario = await session.get(Usuario, idUser)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.intentosFallidos = 0
    usuario.bloqueadoHasta = None
    usuario.vecesBloqueado = 0
    usuario.requiereActivacion = False
    await session.commit()
    return ActivateAccountResponse(message="Cuenta reactivada correctamente")
