import re
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# Duracion del token de recuperacion de contrasena (15 minutos)
PWD_RESET_TOKEN_EXPIRE_MINUTES = 15

# Longitud minima exigida a una contrasena nueva
PASSWORD_MIN_LENGTH = 12

# Reglas de la politica de contrasenas. Cada entrada es
# (codigo, descripcion en espanol, patron regex que debe cumplirse).
# El mismo listado se expone en GET /api/auth/password-policy para que web y
# mobile validen exactamente lo mismo que el backend.
PASSWORD_RULES: list[tuple[str, str, str]] = [
    ("longitud", f"Al menos {PASSWORD_MIN_LENGTH} caracteres", rf".{{{PASSWORD_MIN_LENGTH},}}"),
    ("minuscula", "Al menos una letra minuscula", r"[a-z]"),
    ("mayuscula", "Al menos una letra mayuscula", r"[A-Z]"),
    ("numero", "Al menos un numero", r"\d"),
    ("especial", "Al menos un caracter especial", r"[^A-Za-z0-9]"),
]


def password_policy() -> list[dict]:
    """Devuelve la politica de contrasenas en un formato consumible por los frontends."""
    return [
        {"codigo": codigo, "descripcion": descripcion, "patron": patron}
        for codigo, descripcion, patron in PASSWORD_RULES
    ]


def password_rules_faltantes(password: str) -> list[str]:
    """Devuelve las descripciones de las reglas que la contrasena NO cumple."""
    return [
        descripcion
        for _, descripcion, patron in PASSWORD_RULES
        if not re.search(patron, password)
    ]


def validate_password_strength(password: str) -> None:
    """Valida la fortaleza de una contrasena y lanza ValueError con los requisitos faltantes.

    Reglas: minimo 12 caracteres, al menos una minuscula, una mayuscula,
    un digito y un caracter especial (no alfanumerico).
    """
    if not isinstance(password, str):
        raise ValueError("La contrasena debe ser una cadena de texto")

    faltantes = password_rules_faltantes(password)
    if faltantes:
        raise ValueError(
            "La contrasena no cumple la politica: " + "; ".join(faltantes).lower()
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
