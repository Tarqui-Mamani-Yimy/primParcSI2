from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AsignacionPermiso, Permiso, Rol, Usuario


async def get_permisos_de_usuario(session: AsyncSession, idUser: int) -> list[str]:
    result = await session.execute(
        select(Permiso.nombrePermiso)
        .join(AsignacionPermiso, AsignacionPermiso.idPermiso == Permiso.idPermiso)
        .join(Rol, Rol.codigoRol == AsignacionPermiso.codigoRol)
        .join(Usuario, Usuario.codigoRol == Rol.codigoRol)
        .where(AsignacionPermiso.estado == "Activo", Usuario.idUser == idUser)
    )
    return list(result.scalars().all())


async def get_rol_nombre(session: AsyncSession, codigoRol: int) -> str:
    result = await session.execute(select(Rol.nombreRol).where(Rol.codigoRol == codigoRol))
    rol = result.scalar_one_or_none()
    return rol or "Desconocido"


async def build_user_claims(session: AsyncSession, usuario: Usuario) -> dict:
    permisos = await get_permisos_de_usuario(session, usuario.idUser)
    rol = await get_rol_nombre(session, usuario.codigoRol)
    claims = {
        "correo": usuario.correo,
        "rol": rol,
        "permisos": permisos,
        "empresa": usuario.idEmpresa,
        "plan": None,
        "empresa_info": None,
        "plan_info": None,
        "suscripcion": None,
    }
    if usuario.idEmpresa is None:
        return claims

    result = await session.execute(
        text('''
            SELECT e."idEmpresa", e."nombre", e."slug", e."logoUrl",
                   p."codigo", p."nombre", p."features", p."limites",
                   s."estado", s."fechaFin"
            FROM "Empresa" e
            JOIN "Suscripcion" s ON s."idEmpresa" = e."idEmpresa"
            JOIN "Plan" p ON p."idPlan" = s."idPlan"
            WHERE e."idEmpresa" = :id_empresa
        '''),
        {"id_empresa": usuario.idEmpresa},
    )
    row = result.one_or_none()
    if row is not None:
        (id_empresa, nombre, slug, logo_url, codigo, plan_nombre, features,
         limites, estado_suscripcion, fecha_fin) = row
        claims.update({
            "plan": codigo,
            "empresa_info": {"idEmpresa": id_empresa, "nombre": nombre, "slug": slug, "logoUrl": logo_url},
            "plan_info": {"codigo": codigo, "nombre": plan_nombre, "features": features, "limites": limites},
            "suscripcion": {"estado": estado_suscripcion, "fechaFin": fecha_fin},
        })
    return claims
