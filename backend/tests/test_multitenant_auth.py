import asyncio
from types import SimpleNamespace

from app.schemas.auth import MeResponse, TokenResponse
from app.security import get_tenant
from app.services.usuarios import build_user_claims


class FakeResult:
    def __init__(self, row=None):
        self.row = row

    def one_or_none(self):
        return self.row

    def scalar_one_or_none(self):
        return self.row

    def scalars(self):
        return self

    def all(self):
        return self.row


class FakeSession:
    def __init__(self, rows):
        self.rows = iter(rows)

    async def execute(self, _query, *_args):
        return FakeResult(next(self.rows))


def test_build_user_claims_incluye_empresa_plan_y_suscripcion():
    usuario = SimpleNamespace(idUser=8, correo="admin@example.test", codigoRol=1, idEmpresa=1)
    session = FakeSession([
        ["inventario.ver"],
        "Administrador",
        (1, "YouShop", "youshop", None, "avanzado", "Avanzado",
         ["pos", "ventas"], {"sucursales": None}, "activa", None),
    ])

    claims = asyncio.run(build_user_claims(session, usuario))

    assert claims == {
        "correo": "admin@example.test",
        "rol": "Administrador",
        "permisos": ["inventario.ver"],
        "empresa": 1,
        "plan": "avanzado",
        "empresa_info": {"idEmpresa": 1, "nombre": "YouShop", "slug": "youshop", "logoUrl": None},
        "plan_info": {"codigo": "avanzado", "nombre": "Avanzado", "features": ["pos", "ventas"], "limites": {"sucursales": None}},
        "suscripcion": {"estado": "activa", "fechaFin": None},
    }


def test_superadmin_claims_sin_tenant():
    usuario = SimpleNamespace(idUser=1, correo="root@example.test", codigoRol=9, idEmpresa=None)
    session = FakeSession([[], "SuperAdmin"])

    claims = asyncio.run(build_user_claims(session, usuario))

    assert claims["rol"] == "SuperAdmin"
    assert claims["empresa"] is None
    assert claims["plan"] is None
    assert claims["empresa_info"] is None
    assert claims["plan_info"] is None
    assert claims["suscripcion"] is None


def test_get_tenant_toma_solo_claim_empresa():
    assert get_tenant({"empresa": 7, "plan": "basico", "idEmpresa": 90}) == 7
    assert get_tenant({"empresa": None, "rol": "SuperAdmin"}) is None


def test_auth_response_schemas_requieren_contexto_multitenant():
    tenant_data = {
        "empresa": {"idEmpresa": 1, "nombre": "YouShop", "slug": "youshop", "logoUrl": None},
        "plan": {"codigo": "avanzado", "nombre": "Avanzado", "features": [], "limites": {}},
        "suscripcion": {"estado": "activa", "fechaFin": None},
    }
    token = TokenResponse.model_validate({"access_token": "a", "refresh_token": "r", "user": {
        "idUser": 1, "nombre": "Admin", "correo": "a@b.test", "rol": "Administrador", "permisos": []
    }, **tenant_data})
    me = MeResponse.model_validate({"idUser": 1, "nombre": "Admin", "correo": "a@b.test", "rol": "Administrador", "permisos": [], **tenant_data})

    assert token.empresa.idEmpresa == me.empresa.idEmpresa == 1
    assert token.plan.codigo == me.plan.codigo == "avanzado"
