from app.database import _set_local_auth_context, _set_local_tenant_context


class RecordingConnection:
    def __init__(self):
        self.calls = []

    def execute(self, statement, parameters):
        self.calls.append((str(statement), parameters))


def test_tenant_context_is_set_transaction_locally_from_session_info():
    connection = RecordingConnection()

    _set_local_tenant_context(connection, 17)

    assert len(connection.calls) == 1
    sql, parameters = connection.calls[0]
    assert "set_config('app.empresa_id'" in sql
    assert parameters == {"tenant_id": "17"}


def test_auth_context_is_separate_and_transaction_local():
    connection = RecordingConnection()

    _set_local_auth_context(connection)

    assert len(connection.calls) == 1
    sql, parameters = connection.calls[0]
    assert "set_config('app.auth_user_access'" in sql
    assert parameters == {"enabled": "true"}
