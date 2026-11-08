"""Shared plan fixtures for route tests that exercise previously available features."""

from datetime import date

from app.models import Plan, Suscripcion


ADVANCED_FEATURES = [
    "pos", "inventario", "ventas", "reportes", "despachos", "reservas",
    "pagos_online", "app_movil", "reportes_avanzados", "reportes_export",
    "ia", "probador", "promociones", "fidelizacion", "tallas",
]


def seed_advanced_plan(session, tenant_ids=(1,)):
    session.add(Plan(
        idPlan=1,
        codigo="avanzado",
        nombre="Profesional",
        precioMensual=0,
        precioAnual=0,
        features=ADVANCED_FEATURES.copy(),
        limites={},
    ))
    session.flush()
    for tenant_id in tenant_ids:
        session.add(Suscripcion(
            idSuscripcion=tenant_id,
            idEmpresa=tenant_id,
            idPlan=1,
            estado="activa",
            fechaInicio=date.today(),
        ))
    session.flush()
