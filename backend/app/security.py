import re
from datetime import date, datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

settings = get_settings()


def subscription_inactive_state(estado: str | None, fecha_fin: date | None, today: date | None = None) -> str | None:
    """Return the machine status for a subscription that must not write."""
    if estado != "activa":
        return estado or "vencida"
    if fecha_fin is not None and fecha_fin < (today or date.today()):
        return "vencida"
    return None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# Duracion del token de recuperacion de contrasena (15 minutos)
PWD_RESET_TOKEN_EXPIRE_MINUTES = 15


def validate_password_strength(password: str) -> None:
    """Valida la fortaleza de una contrasena y lanza ValueError con los requisitos faltantes.

    Reglas: minimo 10 caracteres, al menos una minuscula, una mayuscula,
    un digito y un caracter especial (no alfanumerico).
    """
    if not isinstance(password, str):
        raise ValueError("La contrasena debe ser una cadena de texto")

    faltantes = []
    if len(password) < 10:
        faltantes.append("al menos 10 caracteres")
    if not re.search(r"[a-z]", password):
        faltantes.append("una letra minuscula")
    if not re.search(r"[A-Z]", password):
        faltantes.append("una letra mayuscula")
    if not re.search(r"\d", password):
        faltantes.append("un numero")
    if not re.search(r"[^A-Za-z0-9]", password):
        faltantes.append("un caracter especial")

    if faltantes:
        raise ValueError(
            "La contrasena debe tener " + ", ".join(faltantes)
        )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(subject: str, claims: dict, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "iat": now, "exp": now + expires_delta}
    payload.update(claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int, extra_claims: dict) -> str:
    return create_token(
        subject=str(user_id),
        claims=extra_claims,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    return create_token(
        subject=str(user_id),
        claims={},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_pwd_reset_token(user_id: int) -> str:
    """Crea un JWT de corta duracion para recuperacion de contrasena (stateless)."""
    return create_token(
        subject=str(user_id),
        claims={"purpose": "pwd_reset"},
        expires_delta=timedelta(minutes=PWD_RESET_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
        )


def get_current_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporciono token de autenticacion",
        )
    return decode_token(credentials.credentials)


def get_tenant(payload: dict = Depends(get_current_payload)) -> int | None:
    """Return the tenant bound to the signed JWT; never inspect request data."""
    if "empresa" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticacion sin empresa",
        )
    empresa_id = payload["empresa"]
    if empresa_id is None:
        if payload.get("rol") == "SuperAdmin":
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticacion sin empresa",
        )
    try:
        empresa_id = int(empresa_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticacion invalido")
    if empresa_id <= 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticacion invalido")
    return empresa_id


def require_permiso(permiso: str):
    def dependency(payload: dict = Depends(get_current_payload)):
        permisos = payload.get("permisos", [])
        if permiso not in permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tiene permiso '{permiso}'",
            )
        return payload

    return dependency


def require_platform_admin(payload: dict = Depends(get_current_payload)) -> dict:
    """Authorize platform access from signed SuperAdmin claims only."""
    if payload.get("rol") != "SuperAdmin" or "plataforma.admin" not in payload.get("permisos", []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permiso 'plataforma.admin'")
    return payload


def require_feature(feature: str):
    """Require a feature from the tenant's current database-backed plan."""
    from fastapi import Depends
    from sqlalchemy import select
    from app.database import get_tenant_db
    from app.models import Plan, Suscripcion

    async def dependency(payload: dict = Depends(get_current_payload), session=Depends(get_tenant_db)):
        empresa_id = payload.get("empresa")
        result = await session.execute(
            select(Plan.features).join(Suscripcion, Suscripcion.idPlan == Plan.idPlan)
            .where(Suscripcion.idEmpresa == empresa_id)
        )
        features = result.scalar_one_or_none() or []
        if feature not in features:
            raise HTTPException(status_code=403, detail={"code": "feature_not_in_plan", "feature": feature})
        return payload

    return dependency


def check_limit(resource: str, *, public_signup: bool = False):
    """Require remaining capacity according to the current plan's JSON limits."""
    from fastapi import Depends
    from sqlalchemy import func, select
    from app.database import bind_session_tenant, get_auth_db, get_tenant_db
    from app.models import Plan, Suscripcion, Sucursal, Usuario, Producto

    models = {"sucursales": Sucursal, "usuarios": Usuario, "productos": Producto}
    if resource not in models:
        raise ValueError(f"Unknown plan limit: {resource}")
    model = models[resource]

    async def dependency(payload: dict = Depends(get_current_payload) if not public_signup else None,
                         session=Depends(get_auth_db if public_signup else get_tenant_db)):
        empresa_id = 1 if public_signup else payload.get("empresa")
        if public_signup:
            await bind_session_tenant(session, empresa_id)
        plan_result = await session.execute(
            select(Plan.limites).join(Suscripcion, Suscripcion.idPlan == Plan.idPlan)
            .where(Suscripcion.idEmpresa == empresa_id)
        )
        limits = plan_result.scalar_one_or_none() or {}
        count_result = await session.execute(
            select(func.count(model.idEmpresa)).where(model.idEmpresa == empresa_id)
        )
        current = count_result.scalar_one()
        limit = limits.get(resource)
        if limit is not None and current >= limit:
            raise HTTPException(status_code=403, detail={"code": "plan_limit_reached", "recurso": resource, "limite": limit})
        return None

    return dependency


def require_active_subscription():
    """Block mutating requests on inactive subscriptions while preserving reads."""
    from fastapi import Depends, Request
    from sqlalchemy import select
    from app.database import get_tenant_db
    from app.models import Suscripcion

    async def dependency(request: Request, payload: dict = Depends(get_current_payload), session=Depends(get_tenant_db)):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return None
        result = await session.execute(select(Suscripcion.estado, Suscripcion.fechaFin).where(Suscripcion.idEmpresa == payload.get("empresa")))
        row = result.one_or_none()
        inactive_state = subscription_inactive_state(*(row or (None, None)))
        if inactive_state is not None:
            raise HTTPException(status_code=403, detail={"code": "subscription_inactive", "estado": inactive_state})
        return None

    return dependency
