from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, with_loader_criteria
from sqlalchemy.pool import NullPool
from uuid import uuid4

from app.config import get_settings
from app.security import get_tenant, require_platform_admin, subscription_inactive_state

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # El pooler de Supabase (Supavisor) en modo "transaction" no soporta
    # prepared statements: cada query puede caer en una conexion fisica
    # distinta del pool. "statement_cache_size" apaga la cache de asyncpg,
    # pero el dialecto asyncpg de SQLAlchemy mantiene su PROPIA cache de
    # statements nombrados por encima de esa (de ahi los nombres
    # "__asyncpg_stmt_N__" en el error); hay que apagar tambien esta con
    # "prepared_statement_cache_size" o el error persiste bajo concurrencia.
    # Aun sin cache, asyncpg numera los statements por conexion
    # ("__asyncpg_stmt_N__") y, detras del pooler, dos conexiones logicas
    # comparten la misma conexion fisica, asi que los numeros chocan
    # (DuplicatePreparedStatementError). Un nombre UUID por statement lo evita,
    # y NullPool deja el pooling en manos de Supavisor (receta oficial de
    # SQLAlchemy para PgBouncer).
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    },
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _set_local_tenant_context(connection, tenant_id: int) -> None:
    """Bind a tenant to the current PostgreSQL transaction (never the connection)."""
    connection.execute(
        text("SELECT set_config('app.empresa_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )


def _set_local_auth_context(connection) -> None:
    """Permit only the narrow pre-token Usuario auth policy in this transaction."""
    connection.execute(
        text("SELECT set_config('app.auth_user_access', :enabled, true)"),
        {"enabled": "true"},
    )



class Base(DeclarativeBase):
    pass


@event.listens_for(Session, "after_begin")
def _set_rls_tenant_for_transaction(session, transaction, connection):
    # `SET LOCAL`/set_config(..., true) is transaction-scoped. SQLAlchemy emits
    # after_begin again for every transaction, so commits/rollbacks clear the
    # setting and the next transaction is explicitly rebound before its query.
    if transaction.nested:
        return
    if session.info.get("auth_user_access"):
        _set_local_auth_context(connection)
    tenant_id = session.info.get("tenant_id")
    if session.info.get("tenant_scoped") and tenant_id is None:
        raise PermissionError("Tenant-scoped database session has no tenant")
    if tenant_id is not None:
        _set_local_tenant_context(connection, tenant_id)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def get_auth_db() -> AsyncSession:
    """Restricted pre-token session for existing auth endpoints only."""
    async with AsyncSessionLocal() as session:
        session.info["auth_user_access"] = True
        yield session


async def get_platform_db(_payload=Depends(require_platform_admin)) -> AsyncSession:
    """Yield an unscoped session only for a signed platform administrator."""
    async with AsyncSessionLocal() as session:
        connection = await session.connection()
        await connection.execute(text("SELECT set_config('app.platform_admin', 'true', true)"))
        yield session


async def get_billing_webhook_db() -> AsyncSession:
    """Yield a platform-scoped session only for the verified server webhook."""
    async with AsyncSessionLocal() as session:
        connection = await session.connection()
        await connection.execute(text("SELECT set_config('app.billing_webhook', 'true', true)"))
        yield session


async def bind_session_tenant(session: AsyncSession, tenant_id: int) -> None:
    """Bind a known tenant for the current and all later session transactions."""
    if tenant_id is None or tenant_id <= 0:
        raise PermissionError("A positive tenant id is required")
    session.info.update(tenant_scoped=True, tenant_id=tenant_id)
    connection = await session.connection()
    # Must be awaited on the AsyncConnection: running it through
    # sync_connection from async code raises MissingGreenlet under asyncpg.
    await connection.execute(
        text("SELECT set_config('app.empresa_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )


@event.listens_for(Session, "do_orm_execute")
def _scope_tenant_orm_statements(execute_state):
    tenant_id = execute_state.session.info.get("tenant_id")
    if not execute_state.session.info.get("tenant_scoped"):
        return
    if tenant_id is None:
        raise PermissionError("Tenant-scoped database session has no tenant")

    statement = execute_state.statement
    if execute_state.is_select:
        for mapper in Base.registry.mappers:
            model = mapper.class_
            if hasattr(model, "idEmpresa"):
                statement = statement.options(
                    with_loader_criteria(
                        model,
                        lambda cls: cls.idEmpresa == tenant_id,
                        include_aliases=True,
                    )
                )
        execute_state.statement = statement
    elif execute_state.is_update or execute_state.is_delete:
        entity = getattr(statement, "entity_description", {}).get("entity")
        if entity is not None and hasattr(entity, "idEmpresa"):
            execute_state.statement = statement.where(entity.idEmpresa == tenant_id)


@event.listens_for(Session, "before_flush")
def _scope_tenant_writes(session, _flush_context, _instances):
    if not session.info.get("tenant_scoped"):
        return
    tenant_id = session.info.get("tenant_id")
    if tenant_id is None:
        raise PermissionError("Tenant-scoped database session has no tenant")
    for instance in session.new:
        if hasattr(instance, "idEmpresa"):
            current = getattr(instance, "idEmpresa")
            if current is not None and current != tenant_id:
                raise PermissionError("Cannot write a business record for another tenant")
            instance.idEmpresa = tenant_id
    for instance in session.dirty | session.deleted:
        if hasattr(instance, "idEmpresa") and getattr(instance, "idEmpresa") != tenant_id:
            raise PermissionError("Cannot modify a business record for another tenant")


async def get_tenant_db(request: Request, tenant_id: int | None = Depends(get_tenant)) -> AsyncSession:
    """Yield a fail-closed session whose ORM operations are tenant-scoped."""
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant requerido")
    async with AsyncSessionLocal() as session:
        session.info.update(tenant_scoped=True, tenant_id=tenant_id)
        # Subscription state is checked from the database for every mutation;
        # reads remain available so users can inspect data and subscription status.
        if (request is not None and request.method not in {"GET", "HEAD", "OPTIONS"}
                and not request.url.path.startswith("/api/billing/")):
            from sqlalchemy import select
            from app.models import Suscripcion
            subscription = (await session.execute(
                select(Suscripcion.estado, Suscripcion.fechaFin).where(Suscripcion.idEmpresa == tenant_id)
            )).one_or_none()
            inactive_state = subscription_inactive_state(*(subscription or (None, None)))
            if inactive_state is not None:
                raise HTTPException(status_code=403, detail={
                    "code": "subscription_inactive", "estado": inactive_state
                })
        yield session
