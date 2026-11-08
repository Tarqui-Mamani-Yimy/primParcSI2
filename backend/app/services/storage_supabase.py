"""Wrapper delgado sobre el SDK sincrono de Supabase Storage.

Igual que `pagos_stripe.py`, el SDK de `supabase-py` es sincrono, asi que
la subida corre en un hilo aparte via `anyio.to_thread.run_sync` para no
bloquear el event loop de FastAPI.

Si `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no estan configuradas,
`supabase_configurado()` devuelve False y el router debe responder 503
antes de llamar a cualquier funcion de este modulo — mismo patron de
degradacion que Stripe/Brevo.
"""

import mimetypes
import uuid

import anyio

from app.config import get_settings

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - supabase siempre deberia estar instalado
    Client = None
    create_client = None

settings = get_settings()

_client: "Client | None" = None


class SupabaseNoConfigurado(RuntimeError):
    """Faltan credenciales de Supabase o el paquete `supabase` no esta instalado."""


class SupabaseStorageError(RuntimeError):
    """Supabase Storage respondio con un error al subir el archivo."""


def supabase_configurado() -> bool:
    """True solo si el paquete `supabase` esta importado Y hay credenciales."""
    return (
        create_client is not None
        and bool(settings.SUPABASE_URL)
        and bool(settings.SUPABASE_SERVICE_ROLE_KEY)
    )


def _get_client() -> "Client":
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def _public_url(path: str) -> str:
    base = settings.SUPABASE_URL.rstrip("/")
    return f"{base}/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/{path}"


def _upload_sync(path: str, contenido: bytes, content_type: str) -> None:
    client = _get_client()
    client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
        path, contenido, {"content-type": content_type}
    )


async def subir_imagen_producto(nombre_archivo: str, contenido: bytes) -> str:
    """Sube una imagen de producto al bucket publico y devuelve su URL publica.

    `nombre_archivo` solo se usa para inferir la extension/content-type; el
    path real en el bucket es un UUID nuevo para evitar colisiones y no
    depender del nombre original del archivo del usuario.
    """
    if not supabase_configurado():
        raise SupabaseNoConfigurado(
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas o paquete supabase ausente"
        )

    content_type = mimetypes.guess_type(nombre_archivo)[0] or "application/octet-stream"
    extension = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else "bin"
    path = f"productos/{uuid.uuid4().hex}.{extension}"

    try:
        await anyio.to_thread.run_sync(_upload_sync, path, contenido, content_type)
    except Exception as exc:
        raise SupabaseStorageError(str(exc)) from exc

    return _public_url(path)


def _upload_backup_sync(bucket: str, path: str, contenido: bytes) -> None:
    _private_backup_storage().upload(
        path,
        contenido,
        {"content-type": "application/gzip", "upsert": "false"},
    )


def _list_backup_sync(bucket: str, prefix: str) -> list[dict]:
    client = _private_backup_storage()
    folder = prefix.rstrip("/")
    offset = 0
    page_size = 1000
    objects = []
    while True:
        page = client.list(folder, {"limit": page_size, "offset": offset})
        for item in page:
            name = item.get("name") if isinstance(item, dict) else getattr(item, "name", None)
            if not name:
                continue
            objects.append({
                "name": f"{folder}/{name}",
                "created_at": item.get("created_at") if isinstance(item, dict) else getattr(item, "created_at", None),
                "metadata": item.get("metadata") if isinstance(item, dict) else getattr(item, "metadata", None),
            })
        if len(page) < page_size:
            return objects
        offset += page_size


def _delete_backup_sync(bucket: str, paths: list[str]) -> None:
    if paths:
        _private_backup_storage().remove(paths)


def _signed_backup_url_sync(bucket: str, path: str, expires_in: int) -> str:
    result = _private_backup_storage().create_signed_url(path, expires_in)
    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
    return getattr(result, "signedURL", None) or getattr(result, "signedUrl", None)


def _backup_bucket() -> str:
    return get_settings().SUPABASE_BACKUP_BUCKET


def _private_backup_storage():
    bucket = _backup_bucket()
    if bucket == get_settings().SUPABASE_STORAGE_BUCKET:
        raise SupabaseStorageError(
            "El bucket de backups no puede ser el bucket público de imágenes"
        )
    client = _get_client()
    # list_buckets instead of get_bucket: get_bucket fails to parse newer
    # Supabase responses (unknown 'versioning_status' field).
    is_public = None
    for bucket_info in client.storage.list_buckets():
        name = (
            bucket_info.get("name")
            if isinstance(bucket_info, dict)
            else getattr(bucket_info, "name", None)
        )
        if name == bucket:
            is_public = (
                bucket_info.get("public")
                if isinstance(bucket_info, dict)
                else getattr(bucket_info, "public", None)
            )
            break
    if is_public is not False:
        raise SupabaseStorageError(
            "El bucket configurado para backups debe existir y ser privado"
        )
    return client.storage.from_(bucket)


async def subir_backup(path: str, contenido: bytes) -> None:
    if not supabase_configurado():
        raise SupabaseNoConfigurado(
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas o paquete supabase ausente"
        )
    try:
        await anyio.to_thread.run_sync(_upload_backup_sync, _backup_bucket(), path, contenido)
    except Exception as exc:
        raise SupabaseStorageError(str(exc)) from exc


async def listar_objetos_backup(prefix: str) -> list[dict]:
    if not supabase_configurado():
        raise SupabaseNoConfigurado(
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas o paquete supabase ausente"
        )
    try:
        return await anyio.to_thread.run_sync(_list_backup_sync, _backup_bucket(), prefix)
    except Exception as exc:
        raise SupabaseStorageError(str(exc)) from exc


async def list_backup_objects(prefix: str) -> list[dict]:
    """Expose backup listing for retention without coupling it to SDK calls."""
    return await listar_objetos_backup(prefix)


async def eliminar_objetos_backup(paths: list[str]) -> None:
    if not supabase_configurado():
        raise SupabaseNoConfigurado(
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas o paquete supabase ausente"
        )
    try:
        await anyio.to_thread.run_sync(_delete_backup_sync, _backup_bucket(), paths)
    except Exception as exc:
        raise SupabaseStorageError(str(exc)) from exc


async def delete_backup_objects(paths: list[str]) -> None:
    await eliminar_objetos_backup(paths)


async def crear_url_firmada_backup(path: str, expires_in: int = 300) -> str:
    if not supabase_configurado():
        raise SupabaseNoConfigurado(
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas o paquete supabase ausente"
        )
    try:
        return await anyio.to_thread.run_sync(
            _signed_backup_url_sync, _backup_bucket(), path, expires_in
        )
    except Exception as exc:
        raise SupabaseStorageError(str(exc)) from exc
