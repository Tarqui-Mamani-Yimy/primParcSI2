from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    PWD_RESET_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_pwd_reset_token,
    create_refresh_token,
    decode_token,
    get_current_payload,
    hash_password,
    verify_password,
)
from app.services.usuarios import build_user_claims

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _find_usuario_by_email(session: AsyncSession, email: str) -> Usuario | None:
    result = await session.execute(select(Usuario).where(Usuario.correo == email))
    return result.scalar_one_or_none()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    usuario = await _find_usuario_by_email(session, payload.email)
    if not usuario or not verify_password(payload.password, usuario.contraseña):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

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

    from sqlalchemy import text

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
