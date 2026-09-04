from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Usuario
from app.schemas.auth import (
    CuentaEstadoResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MeResponse,
    PasswordChangedResponse,
    PasswordPolicyResponse,
    PasswordUpdate,
    PasswordUpdatedResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UnlockResponse,
    UserSummary,
)
from app.security import (
    PASSWORD_MIN_LENGTH,
    PWD_RESET_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_pwd_reset_token,
    create_refresh_token,
    decode_token,
    get_current_payload,
    hash_password,
    password_policy,
    require_permiso,
    verify_password,
)
from app.services.usuarios import build_user_claims

router = APIRouter(prefix="/api/auth", tags=["auth"])

settings = get_settings()


async def _find_usuario_by_email(session: AsyncSession, email: str) -> Usuario | None:
    result = await session.execute(select(Usuario).where(Usuario.correo == email))
    return result.scalar_one_or_none()


def _error_cuenta_bloqueada(usuario: Usuario) -> HTTPException:
    """423 Locked: la cuenta esta bloqueada y solo un administrador puede reactivarla."""
    return HTTPException(
        status_code=status.HTTP_423_LOCKED,
        detail={
            "code": "cuenta_bloqueada",
            "message": (
                f"Cuenta bloqueada tras {settings.MAX_INTENTOS_LOGIN} intentos fallidos. "
                "Contacta al administrador para reactivarla."
            ),
            "intentos_restantes": 0,
        },
    )


@router.get("/password-policy", response_model=PasswordPolicyResponse)
async def get_password_policy():
    """Reglas de contrasena y limite de intentos, para que los frontends validen igual."""
    return PasswordPolicyResponse(
        min_length=PASSWORD_MIN_LENGTH,
        reglas=password_policy(),
        max_intentos_login=settings.MAX_INTENTOS_LOGIN,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    usuario = await _find_usuario_by_email(session, payload.email)

    # Correo inexistente: respuesta generica, no hay contador que actualizar.
    if not usuario:
        raise HTTPException(
            status_code=401,
            detail={"code": "credenciales_invalidas", "message": "Credenciales invalidas"},
        )

    if usuario.bloqueado:
        raise _error_cuenta_bloqueada(usuario)

    if not verify_password(payload.password, usuario.contraseña):
        usuario.intentos_fallidos += 1
        usuario.ultimo_intento = datetime.now(timezone.utc)

        if usuario.intentos_fallidos >= settings.MAX_INTENTOS_LOGIN:
            usuario.bloqueado = True
            usuario.fecha_bloqueo = usuario.ultimo_intento
            await session.commit()
            raise _error_cuenta_bloqueada(usuario)

        restantes = settings.MAX_INTENTOS_LOGIN - usuario.intentos_fallidos
        await session.commit()
        raise HTTPException(
            status_code=401,
            detail={
                "code": "credenciales_invalidas",
                "message": (
                    f"Credenciales invalidas. Te queda(n) {restantes} intento(s) "
                    "antes de que la cuenta se bloquee."
                ),
                "intentos_restantes": restantes,
            },
        )

    # Login correcto: se reinicia el contador de intentos fallidos.
    if usuario.intentos_fallidos:
        usuario.intentos_fallidos = 0
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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db),
):
    """Paso 1 de la recuperacion: genera un token de un solo uso.

    Siempre responde lo mismo exista o no el correo, para no revelar que
    cuentas estan registradas. En desarrollo el token viaja en
    `reset_token_dev` porque el proyecto no tiene envio de correo montado.
    """
    usuario = await _find_usuario_by_email(session, payload.email)

    mensaje = (
        "Si el correo esta registrado, recibiras instrucciones para "
        f"restablecer tu contrasena. El enlace vence en {PWD_RESET_TOKEN_EXPIRE_MINUTES} minutos."
    )

    if not usuario:
        return ForgotPasswordResponse(message=mensaje, reset_token_dev=None)

    return ForgotPasswordResponse(
        message=mensaje,
        reset_token_dev=create_pwd_reset_token(usuario.idUser),
    )


@router.post("/reset-password", response_model=PasswordUpdatedResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db),
):
    """Paso 2 de la recuperacion: fija la contrasena nueva.

    La politica de contrasenas la valida `ResetPasswordRequest` (422 si no se
    cumple). Al restablecerla se desbloquea la cuenta y se reinicia el contador
    de intentos fallidos: quien demuestra ser el dueno del correo recupera el
    acceso sin depender de un administrador.
    """
    decoded = decode_token(payload.token)

    if decoded.get("purpose") != "pwd_reset":
        raise HTTPException(status_code=400, detail="El token no sirve para restablecer la contrasena")

    try:
        user_id = int(decoded["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Token de recuperacion invalido")

    usuario = await session.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.contraseña = hash_password(payload.new_password)
    usuario.bloqueado = False
    usuario.intentos_fallidos = 0
    usuario.fecha_bloqueo = None
    await session.commit()

    return PasswordUpdatedResponse(
        message="Contrasena actualizada. Ya puedes iniciar sesion."
    )


@router.post("/change-password", response_model=PasswordChangedResponse)
async def change_password(
    payload: PasswordUpdate,
    claims: dict = Depends(get_current_payload),
    session: AsyncSession = Depends(get_db),
):
    """Cambio de contrasena de un usuario con sesion iniciada."""
    usuario = await session.get(Usuario, int(claims["sub"]))
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(payload.current_password, usuario.contraseña):
        raise HTTPException(status_code=400, detail="La contrasena actual no es correcta")

    usuario.contraseña = hash_password(payload.new_password)
    usuario.intentos_fallidos = 0
    await session.commit()

    return PasswordChangedResponse(message="Contrasena cambiada correctamente")


def _estado_cuenta(usuario: Usuario) -> CuentaEstadoResponse:
    return CuentaEstadoResponse(
        idUser=usuario.idUser,
        correo=usuario.correo,
        bloqueado=usuario.bloqueado,
        intentos_fallidos=usuario.intentos_fallidos,
        fecha_bloqueo=usuario.fecha_bloqueo,
    )


@router.get("/cuentas-bloqueadas", response_model=list[CuentaEstadoResponse])
async def cuentas_bloqueadas(
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("usuario.admin")),
):
    """Lista las cuentas bloqueadas por intentos fallidos."""
    usuarios = (
        await session.execute(select(Usuario).where(Usuario.bloqueado.is_(True)))
    ).scalars().all()
    return [_estado_cuenta(u) for u in usuarios]


@router.post("/desbloquear/{id_user}", response_model=UnlockResponse)
async def desbloquear_cuenta(
    id_user: int,
    session: AsyncSession = Depends(get_db),
    _=Depends(require_permiso("usuario.admin")),
):
    """Reactiva una cuenta bloqueada y reinicia el contador de intentos fallidos."""
    usuario = await session.get(Usuario, id_user)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.bloqueado = False
    usuario.intentos_fallidos = 0
    usuario.fecha_bloqueo = None
    await session.commit()
    await session.refresh(usuario)

    return UnlockResponse(
        message=f"Cuenta {usuario.correo} desbloqueada",
        usuario=_estado_cuenta(usuario),
    )
