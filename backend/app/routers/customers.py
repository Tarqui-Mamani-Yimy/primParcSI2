from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Cliente, Usuario
from app.schemas.fase2 import ClienteCreate, ClienteFull, ClienteUpdate
from app.security import require_permiso

router = APIRouter(prefix="/api/customers", tags=["customers"])


async def _serialize(c: Cliente, session: AsyncSession) -> ClienteFull:
    u = await session.get(Usuario, c.idUser)
    return ClienteFull(
        idCliente=c.idCliente,
        nombre=c.nombre,
        telefono=c.telefono,
        direccion=c.direccion,
        idUser=c.idUser,
        correo=u.correo if u else None,
    )


@router.get("", response_model=list[ClienteFull])
async def list_customers(session: AsyncSession = Depends(get_db),
                         _=Depends(require_permiso("cliente.ver"))):
    rows = (await session.execute(select(Cliente).order_by(Cliente.nombre))).scalars().all()
    return [await _serialize(c, session) for c in rows]


@router.get("/{idCliente}", response_model=ClienteFull)
async def get_customer(idCliente: int, session: AsyncSession = Depends(get_db),
                       _=Depends(require_permiso("cliente.ver"))):
    c = await session.get(Cliente, idCliente)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return await _serialize(c, session)


@router.post("", response_model=ClienteFull, status_code=201)
async def create_customer(
    payload: ClienteCreate,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("usuario.admin")),
):
    if not await session.get(Usuario, payload.idUser):
        raise HTTPException(status_code=400, detail="Usuario inexistente")
    c = Cliente(**payload.model_dump())
    session.add(c)
    await session.commit()
    await session.refresh(c)
    return await _serialize(c, session)


@router.put("/{idCliente}", response_model=ClienteFull)
async def update_customer(
    idCliente: int,
    payload: ClienteUpdate,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("cliente.ver")),
):
    c = await session.get(Cliente, idCliente)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "idUser" in data and not await session.get(Usuario, data["idUser"]):
        raise HTTPException(status_code=400, detail="Usuario inexistente")
    for k, v in data.items():
        setattr(c, k, v)
    await session.commit()
    await session.refresh(c)
    return await _serialize(c, session)


@router.delete("/{idCliente}", status_code=204)
async def delete_customer(
    idCliente: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("usuario.admin")),
):
    c = await session.get(Cliente, idCliente)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await session.delete(c)
    await session.commit()
