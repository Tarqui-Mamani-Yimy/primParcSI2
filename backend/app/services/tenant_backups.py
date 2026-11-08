"""Tenant-isolated database exports and backup retention helpers."""

import base64
import gzip
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Awaitable, Callable
from uuid import UUID

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

BACKUP_NAME_PATTERN = re.compile(
    r"^(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)_(?P<tipo>manual|automatico)\.json\.gz$"
)
BACKUP_FORMAT_VERSION = 1


@dataclass(frozen=True)
class BackupArtifact:
    nombre: str
    generated_at: datetime
    content: bytes
    row_counts: dict[str, int]

    @property
    def tamano_bytes(self) -> int:
        return len(self.content)


@dataclass(frozen=True)
class _TableInfo:
    name: str
    columns: tuple[str, ...]
    tenant_scoped: bool
    vector_columns: tuple[str, ...]


def _discover_public_tables(connection) -> list[_TableInfo]:
    inspector = inspect(connection)
    schema = "public" if connection.dialect.name == "postgresql" else None
    tables = []
    for name in inspector.get_table_names(schema=schema):
        columns = inspector.get_columns(name, schema=schema)
        column_names = tuple(column["name"] for column in columns)
        vector_columns = tuple(
            column["name"]
            for column in columns
            if "vector" in str(column["type"]).lower()
        )
        tables.append(
            _TableInfo(
                name=name,
                columns=column_names,
                tenant_scoped="idEmpresa" in column_names,
                vector_columns=vector_columns,
            )
        )
    return tables


async def _table_inventory(session: AsyncSession) -> tuple[Any, list[_TableInfo]]:
    connection = await session.connection()
    tables = await connection.run_sync(_discover_public_tables)
    return connection.dialect.identifier_preparer, tables


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "base64:" + base64.b64encode(bytes(value)).decode("ascii")
    return str(value)


def _backup_name(generated_at: datetime, trigger: str) -> str:
    return f"{generated_at.strftime('%Y-%m-%dT%H-%M-%SZ')}_{trigger}.json.gz"


def parse_backup_name(name: str):
    match = BACKUP_NAME_PATTERN.fullmatch(name)
    if match is None:
        return None
    try:
        generated_at = datetime.strptime(
            match.group("timestamp"), "%Y-%m-%dT%H-%M-%SZ"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return match, generated_at


def _as_utc(value: datetime | None) -> datetime:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def _export(
    session: AsyncSession,
    *,
    trigger: str,
    tenant_id: int | None,
    include_global: bool,
    now: datetime | None = None,
) -> BackupArtifact:
    if trigger not in {"manual", "automatico"}:
        raise ValueError("trigger must be manual or automatico")
    generated_at = _as_utc(now)
    preparer, inventory = await _table_inventory(session)
    rows_by_table: dict[str, list[dict[str, Any]]] = {}
    row_counts: dict[str, int] = {}
    vector_columns: dict[str, list[str]] = {}

    for table in inventory:
        if table.tenant_scoped and tenant_id is not None:
            predicate = f" WHERE {preparer.quote('idEmpresa')} = :empresa_id"
            parameters = {"empresa_id": tenant_id}
        elif not table.tenant_scoped and include_global:
            predicate = ""
            parameters = {}
        else:
            continue

        selected_columns = []
        for column in table.columns:
            quoted = preparer.quote(column)
            if column in table.vector_columns:
                selected_columns.append(f"CAST({quoted} AS TEXT) AS {quoted}")
            else:
                selected_columns.append(quoted)
        table_ref = preparer.quote(table.name)
        schema_prefix = '"public".' if session.bind.dialect.name == "postgresql" else ""
        query = text(
            f"SELECT {', '.join(selected_columns)} FROM {schema_prefix}{table_ref}{predicate}"
        )
        result = await session.execute(query, parameters)
        rows = [dict(row) for row in result.mappings().all()]
        rows_by_table[table.name] = rows
        row_counts[table.name] = len(rows)
        if table.vector_columns:
            vector_columns[table.name] = list(table.vector_columns)

    company_row = None
    if tenant_id is not None:
        company_row = next(
            (row for row in rows_by_table.get("Empresa", []) if row.get("idEmpresa") == tenant_id),
            None,
        )
        if company_row is None:
            raise LookupError(f"Empresa {tenant_id} no encontrada")

    metadata = {
        "idEmpresa": tenant_id,
        "empresaNombre": company_row.get("nombre") if company_row else "_global",
        "empresaSlug": company_row.get("slug") if company_row else "_global",
        "generatedAt": generated_at.isoformat(),
        "trigger": trigger,
        "schemaVersion": BACKUP_FORMAT_VERSION,
        "formatVersion": BACKUP_FORMAT_VERSION,
        "rowCounts": row_counts,
        "vectorColumns": vector_columns,
    }
    raw = json.dumps(
        {"metadata": metadata, "tables": rows_by_table},
        ensure_ascii=False,
        sort_keys=True,
        default=_json_default,
    ).encode("utf-8")
    return BackupArtifact(
        nombre=_backup_name(generated_at, trigger),
        generated_at=generated_at,
        content=gzip.compress(raw, mtime=0),
        row_counts=row_counts,
    )


async def create_backup_export(
    session: AsyncSession,
    tenant_id: int,
    trigger: str,
    *,
    now: datetime | None = None,
) -> BackupArtifact:
    return await _export(
        session,
        trigger=trigger,
        tenant_id=tenant_id,
        include_global=False,
        now=now,
    )


async def create_global_backup_export(
    session: AsyncSession,
    trigger: str = "automatico",
    *,
    now: datetime | None = None,
) -> BackupArtifact:
    return await _export(
        session,
        trigger=trigger,
        tenant_id=None,
        include_global=True,
        now=now,
    )


async def delete_expired_automatic_backups(
    storage,
    prefix: str,
    retention_days: int,
    *,
    now: datetime | None = None,
) -> list[str]:
    cutoff = _as_utc(now) - timedelta(days=max(0, retention_days))
    expired = []
    for item in await storage.list_backup_objects(prefix):
        name = item["name"]
        basename = name.rsplit("/", 1)[-1]
        parsed = parse_backup_name(basename)
        if not parsed:
            continue
        match, timestamp = parsed
        if match.group("tipo") != "automatico":
            continue
        if timestamp < cutoff:
            expired.append(name)
    if expired:
        await storage.delete_backup_objects(expired)
    return expired


async def run_automatic_backup_batch(
    tenant_ids: list[int],
    backup_company: Callable[[int], Awaitable[Any]],
    backup_global: Callable[[], Awaitable[Any]],
) -> list[str]:
    failures = []
    for tenant_id in tenant_ids:
        try:
            await backup_company(tenant_id)
        except Exception as exc:  # continue so one tenant cannot block the rest
            failures.append(f"empresa {tenant_id}: {type(exc).__name__}")
    try:
        await backup_global()
    except Exception as exc:
        failures.append(f"_global: {type(exc).__name__}")
    return failures


async def _enable_platform_database_scope(session: AsyncSession) -> None:
    if session.bind.dialect.name == "postgresql":
        connection = await session.connection()
        await connection.execute(text("SELECT set_config('app.platform_admin', 'true', true)"))


async def run_automatic_backups(session_factory=None) -> list[str]:
    """Export all tenants and global catalogs; raise only after all attempts."""
    from app.config import get_settings
    from app.database import AsyncSessionLocal
    from app.models import Empresa
    from app.services import storage_supabase
    from sqlalchemy import select

    if not storage_supabase.supabase_configurado():
        raise RuntimeError("Supabase Storage no está configurado")
    session_factory = session_factory or AsyncSessionLocal

    async with session_factory() as session:
        await _enable_platform_database_scope(session)
        tenant_ids = list(
            (await session.execute(select(Empresa.idEmpresa).order_by(Empresa.idEmpresa)))
            .scalars()
            .all()
        )

    async def backup_company(tenant_id: int) -> None:
        async with session_factory() as session:
            await _enable_platform_database_scope(session)
            artifact = await create_backup_export(session, tenant_id, "automatico")
        prefix = f"empresa-{tenant_id}/"
        await storage_supabase.subir_backup(prefix + artifact.nombre, artifact.content)
        await delete_expired_automatic_backups(
            storage_supabase,
            prefix,
            get_settings().BACKUP_RETENTION_DAYS,
        )

    async def backup_global() -> None:
        async with session_factory() as session:
            await _enable_platform_database_scope(session)
            artifact = await create_global_backup_export(session, "automatico")
        await storage_supabase.subir_backup(
            f"_global/{artifact.nombre}", artifact.content
        )

    failures = await run_automatic_backup_batch(tenant_ids, backup_company, backup_global)
    return failures
