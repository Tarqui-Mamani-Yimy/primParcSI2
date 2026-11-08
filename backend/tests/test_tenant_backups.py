import asyncio
import gzip
import json
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy.dialects.sqlite import dialect as sqlite_dialect

from app.database import get_platform_db
from app.main import app
from app.models import Empresa
from app.security import create_access_token
from app.services import tenant_backups
from app.services.tenant_backups import (
    create_backup_export,
    delete_expired_automatic_backups,
    run_automatic_backup_batch,
)


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows


class FakeSession:
    bind = SimpleNamespace(dialect=sqlite_dialect())

    def __init__(self):
        self.tenant_rows = [
            {"id": 1, "idEmpresa": 1, "dato": "solo-uno"},
            {"id": 2, "idEmpresa": 2, "dato": "solo-dos"},
        ]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, model, tenant_id):
        if model is Empresa and tenant_id == 1:
            return SimpleNamespace(idEmpresa=1, nombre="Empresa Uno", slug="uno")
        return None

    async def execute(self, query, parameters=None):
        sql = str(query)
        if 'FROM "Empresa"' in sql:
            return FakeResult([{"idEmpresa": 1, "nombre": "Empresa Uno", "slug": "uno", "estado": "activa"}])
        if 'FROM "BackupTenantRows"' in sql:
            assert 'WHERE "idEmpresa" = :empresa_id' in sql
            tenant_id = parameters["empresa_id"]
            return FakeResult([row for row in self.tenant_rows if row["idEmpresa"] == tenant_id])
        if 'FROM "BackupGlobalRows"' in sql:
            return FakeResult([{"id": 1, "dato": "catalogo"}])
        raise AssertionError(f"Unexpected export query: {sql}")


class FakeSessionFactory:
    def __call__(self):
        return FakeSession()


class FakeStorage:
    def __init__(self, objects=None):
        self.objects = list(objects or [])
        self.deleted = []
        self.uploads = []

    async def list_backup_objects(self, prefix):
        return [item for item in self.objects if item["name"].startswith(prefix)]

    async def delete_backup_objects(self, paths):
        self.deleted.extend(paths)

    async def upload_backup(self, path, content):
        self.uploads.append((path, content))

    async def create_backup_signed_url(self, path, expires_in):
        return f"https://storage.invalid/{path}?expires={expires_in}"


def test_company_backup_contains_only_that_tenant_and_global_data_is_separate(monkeypatch):
    inventory = [
        SimpleNamespace(name="Empresa", columns=("idEmpresa", "nombre", "slug", "estado"), tenant_scoped=True, vector_columns=()),
        SimpleNamespace(name="BackupTenantRows", columns=("id", "idEmpresa", "dato"), tenant_scoped=True, vector_columns=()),
        SimpleNamespace(name="BackupGlobalRows", columns=("id", "dato"), tenant_scoped=False, vector_columns=()),
    ]
    preparer = sqlite_dialect().identifier_preparer
    monkeypatch.setattr(tenant_backups, "_table_inventory", lambda _session: asyncio.sleep(0, result=(preparer, inventory)))
    now = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)
    artifact = asyncio.run(create_backup_export(FakeSession(), 1, "manual", now=now))
    payload = json.loads(gzip.decompress(artifact.content))
    assert payload["metadata"]["idEmpresa"] == 1
    assert payload["metadata"]["empresaNombre"] == "Empresa Uno"
    assert payload["metadata"]["trigger"] == "manual"
    assert payload["metadata"]["generatedAt"] == now.isoformat()
    assert payload["tables"]["BackupTenantRows"] == [{"id": 1, "idEmpresa": 1, "dato": "solo-uno"}]
    assert "solo-dos" not in json.dumps(payload)
    assert "BackupGlobalRows" not in payload["tables"]


def test_retention_deletes_only_expired_automatic_backups():
    now = datetime(2026, 11, 8, tzinfo=timezone.utc)
    storage = FakeStorage([
        {"name": "empresa-4/2026-09-01T00-00-00Z_automatico.json.gz"},
        {"name": "empresa-4/2026-09-01T00-00-00Z_manual.json.gz"},
        {"name": "empresa-4/2026-11-01T00-00-00Z_automatico.json.gz"},
    ])
    removed = asyncio.run(delete_expired_automatic_backups(storage, "empresa-4/", 30, now=now))
    assert removed == ["empresa-4/2026-09-01T00-00-00Z_automatico.json.gz"]
    assert storage.deleted == removed


def test_automatic_batch_continues_after_one_company_fails():
    attempted = []
    global_calls = []

    async def backup_company(company_id):
        attempted.append(company_id)
        if company_id == 2:
            raise RuntimeError("storage unavailable")

    async def backup_global():
        global_calls.append(True)

    failures = asyncio.run(run_automatic_backup_batch([1, 2, 3], backup_company, backup_global))
    assert attempted == [1, 2, 3]
    assert global_calls == [True]
    assert failures == ["empresa 2: RuntimeError"]


def _token(rol, permisos):
    return create_access_token(8, {"rol": rol, "permisos": permisos, "empresa": None, "plan": None})


def test_backup_endpoint_rejects_non_superadmin():
    response = TestClient(app).get(
        "/api/platform/empresas/1/backups",
        headers={"Authorization": f"Bearer {_token('Administrador', ['plataforma.admin'])}"},
    )
    assert response.status_code == 403


def test_backup_download_rejects_invalid_or_foreign_filename(monkeypatch):
    from app.services import storage_supabase
    storage = FakeStorage([{"name": "empresa-2/2026-11-01T00-00-00Z_manual.json.gz"}])
    monkeypatch.setattr(storage_supabase, "supabase_configurado", lambda: True)

    async def list_objects(prefix):
        return await storage.list_backup_objects(prefix)

    monkeypatch.setattr(storage_supabase, "listar_objetos_backup", list_objects)

    async def platform_db():
        async with FakeSessionFactory()() as session:
            yield session

    app.dependency_overrides[get_platform_db] = platform_db
    try:
        headers = {"Authorization": f"Bearer {_token('SuperAdmin', ['plataforma.admin'])}"}
        invalid = TestClient(app).get(
            "/api/platform/empresas/1/backups/not-a-backup.txt/download", headers=headers
        )
        foreign = TestClient(app).get(
            "/api/platform/empresas/1/backups/2026-11-01T00-00-00Z_manual.json.gz/download",
            headers=headers,
        )
        assert invalid.status_code == 404
        assert foreign.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_manual_backup_api_matches_s6a_contract_and_uses_signed_download(monkeypatch):
    from app.routers import tenant_platform
    from app.services import storage_supabase
    from app.services.tenant_backups import BackupArtifact

    generated_at = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)
    name = "2026-11-08T12-00-00Z_manual.json.gz"
    artifact = BackupArtifact(name, generated_at, b"gzip-payload", {"Empresa": 1})
    uploaded = []
    monkeypatch.setattr(storage_supabase, "supabase_configurado", lambda: True)
    monkeypatch.setattr(tenant_platform, "create_backup_export", lambda *_args: asyncio.sleep(0, result=artifact))

    async def upload(path, content):
        uploaded.append((path, content))

    async def list_objects(prefix):
        return [{"name": f"{prefix}{name}", "metadata": {"size": len(artifact.content)}}]

    async def signed_url(path, expires_in):
        return f"https://storage.invalid/{path}?expires={expires_in}"

    monkeypatch.setattr(storage_supabase, "subir_backup", upload)
    monkeypatch.setattr(storage_supabase, "listar_objetos_backup", list_objects)
    monkeypatch.setattr(storage_supabase, "crear_url_firmada_backup", signed_url)

    async def platform_db():
        async with FakeSessionFactory()() as session:
            yield session

    app.dependency_overrides[get_platform_db] = platform_db
    try:
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {_token('SuperAdmin', ['plataforma.admin'])}"}
        created = client.post("/api/platform/empresas/1/backups", headers=headers, json={})
        assert created.status_code == 201
        assert created.json() == {
            "nombre": name,
            "fecha": generated_at.isoformat(),
            "tamanoBytes": len(artifact.content),
            "tipo": "manual",
        }
        assert uploaded == [(f"empresa-1/{name}", artifact.content)]

        listed = client.get("/api/platform/empresas/1/backups", headers=headers)
        assert listed.status_code == 200
        assert listed.json() == [{
            "nombre": name,
            "fecha": generated_at.isoformat(),
            "tamanoBytes": len(artifact.content),
            "tipo": "manual",
        }]

        download = client.get(f"/api/platform/empresas/1/backups/{name}/download", headers=headers)
        assert download.status_code == 200
        assert download.json() == {
            "url": f"https://storage.invalid/empresa-1/{name}?expires=300",
            "expiraEnSegundos": 300,
        }
    finally:
        app.dependency_overrides.clear()


def test_global_backup_contains_only_tables_without_tenant_id(monkeypatch):
    from app.services.tenant_backups import create_global_backup_export

    inventory = [
        SimpleNamespace(name="Empresa", columns=("idEmpresa", "nombre"), tenant_scoped=True, vector_columns=()),
        SimpleNamespace(name="BackupTenantRows", columns=("id", "idEmpresa", "dato"), tenant_scoped=True, vector_columns=()),
        SimpleNamespace(name="BackupGlobalRows", columns=("id", "dato"), tenant_scoped=False, vector_columns=()),
    ]
    preparer = sqlite_dialect().identifier_preparer
    monkeypatch.setattr(tenant_backups, "_table_inventory", lambda _session: asyncio.sleep(0, result=(preparer, inventory)))
    payload = json.loads(gzip.decompress(asyncio.run(create_global_backup_export(FakeSession())).content))
    assert payload["metadata"]["idEmpresa"] is None
    assert payload["metadata"]["trigger"] == "automatico"
    assert set(payload["tables"]) == {"BackupGlobalRows"}
    assert "BackupTenantRows" not in payload["tables"]


def test_manual_backup_returns_contractual_503_when_storage_is_unconfigured(monkeypatch):
    from app.services import storage_supabase
    monkeypatch.setattr(storage_supabase, "supabase_configurado", lambda: False)

    async def platform_db():
        async with FakeSessionFactory()() as session:
            yield session

    app.dependency_overrides[get_platform_db] = platform_db
    try:
        response = TestClient(app).post(
            "/api/platform/empresas/1/backups",
            headers={"Authorization": f"Bearer {_token('SuperAdmin', ['plataforma.admin'])}"},
            json={},
        )
        assert response.status_code == 503
        assert response.json() == {"detail": "Supabase Storage no está configurado"}
        missing = TestClient(app).post(
            "/api/platform/empresas/2/backups",
            headers={"Authorization": f"Bearer {_token('SuperAdmin', ['plataforma.admin'])}"},
            json={},
        )
        assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_private_backup_storage_checks_privacy_via_list_buckets(monkeypatch):
    """get_bucket breaks on newer Supabase responses (unknown 'versioning_status'); use list_buckets."""
    from types import SimpleNamespace

    import pytest

    from app.services import storage_supabase as s

    class FakeStorage:
        def __init__(self, buckets):
            self._buckets = buckets

        def get_bucket(self, name):
            raise TypeError("SyncBucket.__init__() got an unexpected keyword argument 'versioning_status'")

        def list_buckets(self):
            return self._buckets

        def from_(self, name):
            return f"bucket:{name}"

    monkeypatch.setattr(s, "_backup_bucket", lambda: "backups")
    monkeypatch.setattr(s, "get_settings", lambda: SimpleNamespace(SUPABASE_STORAGE_BUCKET="images"))

    private = [SimpleNamespace(name="images", public=True), SimpleNamespace(name="backups", public=False)]
    monkeypatch.setattr(s, "_get_client", lambda: SimpleNamespace(storage=FakeStorage(private)))
    assert s._private_backup_storage() == "bucket:backups"

    public = [SimpleNamespace(name="backups", public=True)]
    monkeypatch.setattr(s, "_get_client", lambda: SimpleNamespace(storage=FakeStorage(public)))
    with pytest.raises(s.SupabaseStorageError):
        s._private_backup_storage()

    monkeypatch.setattr(s, "_get_client", lambda: SimpleNamespace(storage=FakeStorage([])))
    with pytest.raises(s.SupabaseStorageError):
        s._private_backup_storage()
