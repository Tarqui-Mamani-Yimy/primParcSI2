"""CU26: the SuperAdmin changes a tenant's plan and may define its validity (fechaFin)."""
from datetime import date
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.database import get_platform_db
from app.main import app
from app.security import create_access_token


class Result:
    def __init__(self, value): self.value = value
    def one_or_none(self): return self.value
    def scalar_one_or_none(self): return self.value


class PlanChangeSession:
    def __init__(self, subscription):
        self.subscription = subscription
        self.plan = SimpleNamespace(idPlan=3, codigo='avanzado', nombre='Profesional',
                                    stripePriceId=None, stripePriceIdAnual=None)
        self.commits = 0

    async def get(self, model, _id):
        return SimpleNamespace(idEmpresa=7, nombre='Tienda') if model.__name__ == 'Empresa' else None

    async def execute(self, query):
        sql = str(query)
        if 'FROM "Suscripcion"' in sql:
            return Result((self.subscription, SimpleNamespace(idPlan=1, codigo='basico')))
        return Result(self.plan)

    async def commit(self):
        self.commits += 1


def _patch_plan(session, body):
    async def platform_db():
        yield session
    app.dependency_overrides[get_platform_db] = platform_db
    try:
        token = create_access_token(4, {'rol': 'SuperAdmin', 'permisos': ['plataforma.admin'], 'empresa': None, 'plan': None})
        return TestClient(app).patch('/api/platform/empresas/7/plan', json=body,
                                     headers={'Authorization': f'Bearer {token}'})
    finally:
        app.dependency_overrides.clear()


def _subscription(**overrides):
    values = dict(idPlan=1, fechaFin=date(2026, 12, 31), stripeSubscriptionId=None, ciclo='mensual')
    values.update(overrides)
    return SimpleNamespace(**values)


def test_change_plan_sets_validity_end_date():
    session = PlanChangeSession(_subscription())
    response = _patch_plan(session, {'codigoPlan': 'avanzado', 'fechaFin': '2027-06-30'})
    assert response.status_code == 200
    assert response.json() == {'codigoPlan': 'avanzado', 'fechaFin': '2027-06-30'}
    assert session.subscription.idPlan == 3
    assert session.subscription.fechaFin == date(2027, 6, 30)
    assert session.commits == 1


def test_change_plan_without_fecha_fin_keeps_current_validity():
    session = PlanChangeSession(_subscription())
    response = _patch_plan(session, {'codigoPlan': 'avanzado'})
    assert response.status_code == 200
    assert response.json() == {'codigoPlan': 'avanzado', 'fechaFin': '2026-12-31'}
    assert session.subscription.idPlan == 3
    assert session.subscription.fechaFin == date(2026, 12, 31)


def test_change_plan_rejects_validity_on_stripe_managed_subscription():
    session = PlanChangeSession(_subscription(stripeSubscriptionId='sub_123'))
    response = _patch_plan(session, {'codigoPlan': 'avanzado', 'fechaFin': '2027-06-30'})
    assert response.status_code == 409
    assert response.json()['detail'] == {'code': 'vigencia_gestionada_por_stripe'}
    assert session.subscription.idPlan == 1
    assert session.subscription.fechaFin == date(2026, 12, 31)
    assert session.commits == 0


def test_change_plan_unknown_code_returns_404():
    session = PlanChangeSession(_subscription())
    session.plan = None
    response = _patch_plan(session, {'codigoPlan': 'inexistente'})
    assert response.status_code == 404
    assert response.json()['detail'] == 'Plan no encontrado'
    assert session.subscription.idPlan == 1
    assert session.commits == 0
