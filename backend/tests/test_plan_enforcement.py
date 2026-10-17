import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.security import require_feature, check_limit, require_active_subscription


class FakeSession:
    def __init__(self, results):
        self.results = iter(results)

    async def execute(self, _query):
        value = next(self.results)
        return SimpleNamespace(
            one_or_none=lambda: value,
            scalar_one_or_none=lambda: value,
            scalar_one=lambda: value,
        )


def test_feature_missing_has_exact_machine_error_and_reads_plan_from_database():
    dependency = require_feature("ia")
    with pytest.raises(HTTPException) as raised:
        asyncio.run(dependency(
            payload={"empresa": 7},
            session=FakeSession([["pos"]]),
        ))
    assert raised.value.status_code == 403
    assert raised.value.detail == {"code": "feature_not_in_plan", "feature": "ia"}


def test_unlimited_plan_limit_allows_creation():
    dependency = check_limit("productos")
    assert asyncio.run(dependency(
        payload={"empresa": 7},
        session=FakeSession([{"productos": None}, 9999]),
    )) is None


def test_limit_reached_has_exact_machine_error():
    dependency = check_limit("sucursales")
    with pytest.raises(HTTPException) as raised:
        asyncio.run(dependency(
            payload={"empresa": 7},
            session=FakeSession([{"sucursales": 1}, 1]),
        ))
    assert raised.value.status_code == 403
    assert raised.value.detail == {"code": "plan_limit_reached", "recurso": "sucursales", "limite": 1}


def test_inactive_subscription_blocks_writes_but_not_reads():
    dependency = require_active_subscription()
    assert asyncio.run(dependency(request=SimpleNamespace(method="GET"), payload={"empresa": 7},
                                  session=FakeSession([("suspendida", None)]))) is None
    with pytest.raises(HTTPException) as raised:
        asyncio.run(dependency(request=SimpleNamespace(method="POST"), payload={"empresa": 7},
                               session=FakeSession([("suspendida", None)])))
    assert raised.value.status_code == 403
    assert raised.value.detail == {"code": "subscription_inactive", "estado": "suspendida"}


def test_expired_active_subscription_blocks_writes_as_vencida_but_allows_reads():
    from datetime import date, timedelta

    dependency = require_active_subscription()
    expired = date.today() - timedelta(days=1)
    assert asyncio.run(dependency(
        request=SimpleNamespace(method="GET"), payload={"empresa": 7},
        session=FakeSession([("activa", expired)]),
    )) is None
    with pytest.raises(HTTPException) as raised:
        asyncio.run(dependency(
            request=SimpleNamespace(method="POST"), payload={"empresa": 7},
            session=FakeSession([("activa", expired)]),
        ))
    assert raised.value.status_code == 403
    assert raised.value.detail == {"code": "subscription_inactive", "estado": "vencida"}
