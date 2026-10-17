from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bitacora, Usuario


async def registrar_bitacora(
    session: AsyncSession, accion: str, idUser: int, ip: str, idEmpresa: int | None = None
) -> None:
    if idEmpresa is None:
        idEmpresa = await session.scalar(select(Usuario.idEmpresa).where(Usuario.idUser == idUser))
    if idEmpresa is None:
        raise ValueError("Cannot write a business audit record without a tenant")
    now = datetime.now()
    session.add(
        Bitacora(
            accion=accion,
            hora=now.time(),
            fecha=now.date(),
            ip=ip,
            idUser=idUser,
            idEmpresa=idEmpresa,
        )
    )
