"""Local ResNet50 image embeddings and tenant-scoped visual search."""

import io
import logging
import threading
from pathlib import Path
from urllib.parse import urlsplit

import anyio
import httpx
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import and_, case, func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import EmbeddingProducto, Inventario, Producto

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSION = 2048
MAX_IMAGE_BYTES = 5 * 1024 * 1024
_IMAGE_SIZE = 224
_RESIZE_SHORT_EDGE = 256
_MODEL_PATH = Path(__file__).resolve().parents[1] / "ml_models" / "resnet50_int8.onnx"
_session = None
_session_lock = threading.Lock()


class InvalidImageError(ValueError):
    """The uploaded bytes are not a decodable image within the size limit."""


def _preprocess_image(contents: bytes) -> np.ndarray:
    if not contents or len(contents) > MAX_IMAGE_BYTES:
        raise InvalidImageError("invalid image size")
    try:
        with Image.open(io.BytesIO(contents)) as source:
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("image could not be decoded") from exc

    width, height = image.size
    if not width or not height:
        raise InvalidImageError("image has no pixels")
    scale = _RESIZE_SHORT_EDGE / min(width, height)
    resized_size = (round(width * scale), round(height * scale))
    image = image.resize(resized_size, resample=Image.Resampling.BICUBIC)
    left = (image.width - _IMAGE_SIZE) // 2
    top = (image.height - _IMAGE_SIZE) // 2
    image = image.crop((left, top, left + _IMAGE_SIZE, top + _IMAGE_SIZE))

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    mean = np.asarray((0.485, 0.456, 0.406), dtype=np.float32)
    std = np.asarray((0.229, 0.224, 0.225), dtype=np.float32)
    normalized = (pixels - mean) / std
    return np.transpose(normalized, (2, 0, 1))[np.newaxis, ...]


def _get_session():
    global _session
    if _session is None:
        with _session_lock:
            if _session is None:
                if not _MODEL_PATH.is_file():
                    raise RuntimeError(f"Visual embedding model is missing: {_MODEL_PATH}")
                import onnxruntime

                options = onnxruntime.SessionOptions()
                options.enable_cpu_mem_arena = False
                options.intra_op_num_threads = 1
                _session = onnxruntime.InferenceSession(
                    str(_MODEL_PATH),
                    sess_options=options,
                    providers=["CPUExecutionProvider"],
                )
    return _session


def embed_image(contents: bytes) -> list[float]:
    """Return the model's 2048-dimensional, L2-normalized image embedding."""
    tensor = _preprocess_image(contents)
    session = _get_session()
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: tensor})[0]
    vector = np.asarray(output, dtype=np.float32).reshape(-1)
    if vector.size != EMBEDDING_DIMENSION:
        raise RuntimeError(f"Expected {EMBEDDING_DIMENSION} embedding values, got {vector.size}")
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(norm) or norm <= 0:
        raise RuntimeError("Visual model returned an invalid embedding")
    vector = vector / norm
    return vector.tolist()


async def download_image(url: str) -> bytes:
    """Fetch only the configured public image-storage origin, without redirects."""
    settings = get_settings()
    allowed_host = urlsplit(settings.SUPABASE_URL or "").hostname
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or not allowed_host
        or parsed.hostname.lower() != allowed_host.lower()
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("Product image URL is not on the configured storage host")

    data = bytearray()
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > MAX_IMAGE_BYTES:
                raise InvalidImageError("image exceeds 5 MB")
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > MAX_IMAGE_BYTES:
                    raise InvalidImageError("image exceeds 5 MB")
    return bytes(data)


async def index_product_image(
    session: AsyncSession,
    product: Producto,
    tenant_id: int,
) -> bool:
    """Upsert the current product image; remove stale index rows when cleared."""
    if not product.imagen_url:
        await session.execute(
            EmbeddingProducto.__table__.delete().where(
                EmbeddingProducto.idProducto == product.idProducto,
                EmbeddingProducto.idEmpresa == tenant_id,
            )
        )
        await session.commit()
        return False

    contents = await download_image(product.imagen_url)
    vector = await anyio.to_thread.run_sync(embed_image, contents)
    values = {
        "idProducto": product.idProducto,
        "idEmpresa": tenant_id,
        "vector": vector,
        "imagen_url": product.imagen_url,
    }
    dialect = session.get_bind().dialect.name
    if dialect == "sqlite":
        insert = sqlite_insert(EmbeddingProducto).values(**values)
    else:
        insert = postgresql_insert(EmbeddingProducto).values(**values)
    statement = insert.on_conflict_do_update(
        index_elements=[EmbeddingProducto.idProducto],
        set_={
            "idEmpresa": tenant_id,
            "vector": vector,
            "imagen_url": product.imagen_url,
            "fecha": func.now(),
        },
    )
    await session.execute(statement)
    await session.commit()
    return True


async def reindex_products(session: AsyncSession, tenant_id: int) -> dict[str, int]:
    statement = (
        select(Producto, EmbeddingProducto)
        .outerjoin(
            EmbeddingProducto,
            and_(
                EmbeddingProducto.idProducto == Producto.idProducto,
                EmbeddingProducto.idEmpresa == tenant_id,
            ),
        )
        .where(Producto.idEmpresa == tenant_id, Producto.imagen_url.is_not(None))
    )
    rows = (await session.execute(statement)).all()
    candidates = [
        (
            product.idProducto,
            product.imagen_url,
            existing is not None and existing.imagen_url == product.imagen_url,
        )
        for product, existing in rows
    ]
    counts = {"indexados": 0, "omitidos": 0, "errores": 0}
    for product_id, image_url, already_indexed in candidates:
        if already_indexed:
            counts["omitidos"] += 1
            continue
        try:
            product = await session.get(Producto, product_id)
            if product is None or product.imagen_url != image_url:
                counts["omitidos"] += 1
                continue
            await index_product_image(session, product, tenant_id)
            counts["indexados"] += 1
        except Exception:
            try:
                await session.rollback()
            except Exception:
                logger.exception("No se pudo limpiar la sesión al reindexar")
            counts["errores"] += 1
            logger.exception("No se pudo indexar imagen del producto %s", product_id)
    return counts


async def search_products(
    session: AsyncSession,
    tenant_id: int,
    query_vector: list[float],
    limit: int,
) -> dict:
    available_stock = case(
        (
            Inventario.cantidad_actual > Inventario.cantidad_reservada,
            Inventario.cantidad_actual - Inventario.cantidad_reservada,
        ),
        else_=0,
    )
    stock_total = func.coalesce(func.sum(available_stock), 0)
    statement = (
        select(EmbeddingProducto, Producto, stock_total.label("stock_total"))
        .join(Producto, Producto.idProducto == EmbeddingProducto.idProducto)
        .outerjoin(
            Inventario,
            and_(
                Inventario.idProducto == Producto.idProducto,
                Inventario.idEmpresa == tenant_id,
            ),
        )
        .where(
            EmbeddingProducto.idEmpresa == tenant_id,
            Producto.idEmpresa == tenant_id,
            EmbeddingProducto.imagen_url == Producto.imagen_url,
        )
        .group_by(EmbeddingProducto.idProducto, Producto.idProducto)
        .having(stock_total > 0)
    )
    rows = (await session.execute(statement)).all()
    matches = []
    query = np.asarray(query_vector, dtype=np.float32).reshape(-1)
    query_norm = float(np.linalg.norm(query))
    if query.size != EMBEDDING_DIMENSION or not np.isfinite(query_norm) or query_norm <= 0:
        raise ValueError("Invalid query embedding")
    query = query / query_norm

    for embedding, product, available in rows:
        try:
            vector = np.asarray(embedding.vector, dtype=np.float32).reshape(-1)
            norm = float(np.linalg.norm(vector))
            if vector.size != EMBEDDING_DIMENSION or not np.isfinite(norm) or norm <= 0:
                continue
            similarity = float(np.dot(query, vector / norm))
        except (TypeError, ValueError):
            continue
        matches.append((similarity, product, int(available)))

    matches.sort(key=lambda item: (-item[0], item[1].idProducto))
    indexed_count = (
        await session.execute(
            select(func.count(EmbeddingProducto.idProducto))
            .join(Producto, Producto.idProducto == EmbeddingProducto.idProducto)
            .where(
                EmbeddingProducto.idEmpresa == tenant_id,
                Producto.idEmpresa == tenant_id,
                EmbeddingProducto.imagen_url == Producto.imagen_url,
            )
        )
    ).scalar_one()
    return {
        "resultados": [
            {
                "idProducto": product.idProducto,
                "nombre": product.nombre,
                "talla": product.talla,
                "color": product.color,
                "venta": float(product.venta),
                "imagen_url": product.imagen_url,
                "similitud": round(max(0.0, min(1.0, similarity)), 3),
                "stock_total": stock,
            }
            for similarity, product, stock in matches[:limit]
        ],
        "indexados": int(indexed_count),
    }
