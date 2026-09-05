from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TeamMemberOut(BaseModel):
    idUser: int
    nombre: str
    correo: str
    rol: str
    permisos: list[str]


class AuditLogOut(BaseModel):
    idBitacora: int
    accion: str
    hora: time
    fecha: date
    ip: str
    idUser: int
    usuario_nombre: Optional[str] = None


class ActivateAccountResponse(BaseModel):
    message: str
