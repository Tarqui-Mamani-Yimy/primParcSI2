from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Usuario
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MeResponse,
    PasswordChangedResponse,
    PasswordUpdate,
    PasswordUpdatedResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserSummary,
)
from app.security import (
    create_access_token,
    create_pwd_reset_token,
    create_refresh_token,
    decode_token,
    get_current_payload,
    hash_password,
    verify_password,
)
from app.services.usuarios import build_user_claims

settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_INTENTOS_FALLIDOS = 3
BLOQUEO_MINUTOS = 15


async def _find_usuario_by_email(session: AsyncSession, email: str) -> Usuario | None:
    result = await session.execute(select(Usuario).where(Usuario.correo == email))
    return result.scalar_one_or_none()


def _ahora_naive() -> datetime:
    return datetime.utcnow()


def _mensaje_bloqueado(bloqueado_hasta: datetime) -> str:
    restante = int((bloqueado_hasta - _ahora_naive()).total_seconds() // 60)
    restante = max(restante, 1)
    return (
        "Cuenta bloqueada temporalmente por multiples intentos fallidos. "
        f"Intenta de nuevo en {restante} minuto(s)."
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    usuario = await _find_usuario_by_email(session, payload.email)

    if usuario is None:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    ahora = _ahora_naive()

    if usuario.bloqueadoHasta is not None and usuario.bloqueadoHasta > ahora:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=_mensaje_bloqueado(usuario.bloqueadoHasta),
        )

    if not verify_password(payload.password, usuario.contraseña):
        usuario.intentosFallidos = (usuario.intentosFallidos or 0) + 1
        if usuario.intentosFallidos >= MAX_INTENTOS_FALLIDOS:
            usuario.bloqueadoHasta = ahora + timedelta(minutes=BLOQUEO_MINUTOS)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=_mensaje_bloqueado(usuario.bloqueadoHasta),
            )
        restantes = MAX_INTENTOS_FALLIDOS - usuario.intentosFallidos
        await session.commit()
        raise HTTPException(
            status_code=401,
            detail=(
                "Credenciales invalidas. "
                f"Te quedan {restantes} intento(s) antes de bloquear la cuenta."
            ),
        )

    usuario.intentosFallidos = 0
    usuario.bloqueadoHasta = None
    await session.commit()

    claims = await build_user_claims(session, usuario)
    access_token = create_access_token(usuario.idUser, claims)
    refresh_token = create_refresh_token(usuario.idUser)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSummary(
            idUser=usuario.idUser,
            nombre=usuario.nombre,
            correo=usuario.correo,
            rol=claims["rol"],
            permisos=claims["permisos"],
        ),
    )


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db)):
    existing = await _find_usuario_by_email(session, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="El correo ya esta registrado")

    res = await session.execute(
        text('SELECT "codigoRol" FROM "rol" WHERE "nombreRol" = :r'),
        {"r": "Cliente"},
    )
    codigo_cliente = res.scalar_one_or_none()
    if codigo_cliente is None:
        raise HTTPException(status_code=500, detail="Rol Cliente no configurado en la base")

    nuevo = Usuario(
        nombre=payload.nombre,
        correo=payload.email,
        contraseña=hash_password(payload.password),
        codigoRol=codigo_cliente,
    )
    session.add(nuevo)
    await session.commit()
    await session.refresh(nuevo)

    claims = await build_user_claims(session, nuevo)
    access_token = create_access_token(nuevo.idUser, claims)
    refresh_token = create_refresh_token(nuevo.idUser)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSummary(
            idUser=nuevo.idUser,
            nombre=nuevo.nombre,
            correo=nuevo.correo,
            rol=claims["rol"],
            permisos=claims["permisos"],
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    try:
        user_id = int(decoded["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Refresh token invalido")

    usuario = await session.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no existe")

    claims = await build_user_claims(session, usuario)
    access_token = create_access_token(usuario.idUser, claims)
    refresh_token = create_refresh_token(usuario.idUser)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSummary(
            idUser=usuario.idUser,
            nombre=usuario.nombre,
            correo=usuario.correo,
            rol=claims["rol"],
            permisos=claims["permisos"],
        ),
    )


@router.get("/me", response_model=MeResponse)
async def me(payload: dict = Depends(get_current_payload), session: AsyncSession = Depends(get_db)):
    user_id = int(payload["sub"])
    usuario = await session.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return MeResponse(
        idUser=usuario.idUser,
        nombre=usuario.nombre,
        correo=usuario.correo,
        rol=payload.get("rol", ""),
        permisos=payload.get("permisos", []),
    )


@router.patch("/password", response_model=PasswordUpdatedResponse)
async def change_password(
    payload: PasswordUpdate,
    current: dict = Depends(get_current_payload),
    session: AsyncSession = Depends(get_db),
):
    user_id = int(current["sub"])
    usuario = await session.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(payload.current_password, usuario.contraseña):
        raise HTTPException(status_code=400, detail="La contrasena actual no es correcta")

    usuario.contraseña = hash_password(payload.new_password)
    await session.commit()
    return PasswordUpdatedResponse(message="Contrasena actualizada correctamente")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(payload: ForgotPasswordRequest, session: AsyncSession = Depends(get_db)):
    usuario = await _find_usuario_by_email(session, payload.email)
    if usuario is None:
        return ForgotPasswordResponse(
            message="Si el correo esta registrado, recibiras instrucciones para restablecer tu contrasena.",
            reset_token_dev=None,
        )

    reset_token = create_pwd_reset_token(usuario.idUser)
    return ForgotPasswordResponse(
        message="Si el correo esta registrado, recibiras instrucciones para restablecer tu contrasena.",
        reset_token_dev=reset_token,
    )


@router.post("/reset-password", response_model=PasswordChangedResponse)
async def reset_password(payload: ResetPasswordRequest, session: AsyncSession = Depends(get_db)):
    try:
        decoded = jwt.decode(
            payload.token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError:
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperacion es invalido o expiro",
        )

    if decoded.get("purpose") != "pwd_reset":
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperacion es invalido o expiro",
        )

    try:
        user_id = int(decoded["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperacion es invalido o expiro",
        )

    usuario = await session.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperacion es invalido o expiro",
        )

    usuario.contraseña = hash_password(payload.new_password)
    usuario.intentosFallidos = 0
    usuario.bloqueadoHasta = None
    await session.commit()
    return PasswordChangedResponse(message="Contrasena restablecida correctamente")