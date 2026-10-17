import asyncio
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.security import create_access_token, require_platform_admin


class Result:
    def __init__(self, value): self.value = value
    def all(self): return self.value
    def scalars(self): return self
    def scalar_one_or_none(self): return self.value
    def scalar_one(self): return self.value
    def one_or_none(self): return self.value


class Session:
    def __init__(self, rows=None): self.rows = iter(rows or [])
    async def execute(self, query):
        sql = str(query)
        if 'FROM "Plan"' in sql:
            return Result([SimpleNamespace(idPlan=2, codigo='basico', nombre='Básico', precioMensual=49, features=['pos'], limites={'sucursales': 1, 'usuarios': 3, 'productos': 200})])
        if 'FROM "Empresa"' in sql and 'JOIN' in sql: return Result([])
        if 'FROM "Suscripcion"' in sql:
            return Result((SimpleNamespace(estado='activa', fechaFin=None), SimpleNamespace(codigo='basico', nombre='Básico', features=['pos'], limites={'sucursales': 1, 'usuarios': 3, 'productos': 200})))
        return Result(0)
    async def get(self, model, _id):
        return SimpleNamespace(idEmpresa=7, nombre='Tienda', slug='tienda', logoUrl=None) if model.__name__ == 'Empresa' else None


def test_platform_endpoints_require_superadmin_and_platform_permission():
    with pytest.raises(HTTPException) as raised:
        require_platform_admin({'rol': 'Administrador', 'permisos': ['plataforma.admin']})
    assert raised.value.status_code == 403
    with pytest.raises(HTTPException):
        require_platform_admin({'rol': 'SuperAdmin', 'permisos': []})
    assert require_platform_admin({'rol': 'SuperAdmin', 'permisos': ['plataforma.admin']})['rol'] == 'SuperAdmin'


def test_platform_plans_and_companies_have_exact_contract_shapes():
    from app.database import get_platform_db
    session = Session()
    async def platform_db(): yield session
    app.dependency_overrides[get_platform_db] = platform_db
    try:
        token = create_access_token(4, {'rol': 'SuperAdmin', 'permisos': ['plataforma.admin'], 'empresa': None, 'plan': None})
        response = TestClient(app).get('/api/platform/plans', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        assert response.json() == [{'idPlan': 2, 'codigo': 'basico', 'nombre': 'Básico', 'precioMensual': 49.0,
                                    'features': ['pos'], 'limites': {'sucursales': 1, 'usuarios': 3, 'productos': 200}}]
        companies = TestClient(app).get('/api/platform/empresas', headers={'Authorization': f'Bearer {token}'})
        assert companies.status_code == 200 and companies.json() == []
    finally: app.dependency_overrides.clear()


def test_tenant_me_uses_jwt_tenant_and_contract_keys():
    from app.database import get_tenant_db
    async def tenant_db(): yield Session()
    app.dependency_overrides[get_tenant_db] = tenant_db
    try:
        token = create_access_token(4, {'rol': 'Administrador', 'permisos': [], 'empresa': 7, 'plan': 'basico'})
        response = TestClient(app).get('/api/tenant/me?empresa=999', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        assert response.json() == {
            'empresa': {'idEmpresa': 7, 'nombre': 'Tienda', 'slug': 'tienda', 'logoUrl': None},
            'plan': {'codigo': 'basico', 'nombre': 'Básico', 'features': ['pos'], 'limites': {'sucursales': 1, 'usuarios': 3, 'productos': 200}},
            'suscripcion': {'estado': 'activa', 'fechaFin': None}, 'uso': {'sucursales': 0, 'usuarios': 0, 'productos': 0},
        }
    finally: app.dependency_overrides.clear()
