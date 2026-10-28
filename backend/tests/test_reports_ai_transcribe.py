from types import SimpleNamespace

import httpx
import pytest

from tests.test_reports_ai import _headers, report_api


@pytest.fixture
def groq_mock(monkeypatch):
    from app.services import transcripcion_groq

    state = SimpleNamespace(
        api_key="test-groq-key",
        result={"text": "Ventas por sucursal del último mes."},
        error=None,
        calls=[],
    )

    class FakeResponse:
        status_code = 200

        def json(self):
            return state.result

        def raise_for_status(self):
            if self.status_code >= 400:
                request = httpx.Request("POST", "https://api.groq.com/openai/v1/audio/transcriptions")
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("Groq failed", request=request, response=response)

    class FakeAsyncClient:
        def __init__(self, *, timeout):
            state.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, data, files):
            state.calls.append({"url": url, "headers": headers, "data": data, "files": files})
            if state.error:
                raise state.error
            response = FakeResponse()
            response.status_code = state.status_code if hasattr(state, "status_code") else 200
            return response

    monkeypatch.setattr(
        transcripcion_groq,
        "get_settings",
        lambda: SimpleNamespace(
            GROQ_API_KEY=state.api_key,
            GROQ_TRANSCRIPTION_MODEL="whisper-large-v3-turbo",
        ),
    )
    monkeypatch.setattr(transcripcion_groq.httpx, "AsyncClient", FakeAsyncClient)
    return state


def _upload(client, *, content=b"audio-bytes", content_type="audio/webm", role="Administrador"):
    return client.post(
        "/api/reports/ai/transcribe",
        files={"audio": ("voice.webm", content, content_type)},
        headers=_headers(role=role),
    )


@pytest.mark.parametrize("content_type", ["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"])
def test_transcribe_returns_text_and_calls_groq_with_fixed_request(report_api, groq_mock, content_type):
    response = _upload(report_api.client, content_type=content_type)

    assert response.status_code == 200, response.text
    assert response.json() == {"text": "Ventas por sucursal del último mes."}
    call = groq_mock.calls[0]
    assert call["url"] == "https://api.groq.com/openai/v1/audio/transcriptions"
    assert call["headers"] == {"Authorization": "Bearer test-groq-key"}
    assert call["data"] == {"model": "whisper-large-v3-turbo", "language": "es"}
    assert call["files"]["file"] == ("voice.webm", b"audio-bytes", content_type)
    assert groq_mock.timeout == 30


def test_transcribe_returns_clear_503_without_groq_key(report_api, groq_mock):
    groq_mock.api_key = None

    response = _upload(report_api.client)

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "La transcripción por voz no está configurada en este servidor. Configure GROQ_API_KEY."
    )
    assert groq_mock.calls == []


def test_transcribe_rejects_audio_over_10_mib(report_api, groq_mock):
    response = _upload(report_api.client, content=b"a" * (10 * 1024 * 1024 + 1))

    assert response.status_code == 413


def test_transcribe_rejects_unsupported_audio_type(report_api, groq_mock):
    response = _upload(report_api.client, content_type="audio/flac")

    assert response.status_code == 400


def test_transcribe_rejects_empty_audio(report_api, groq_mock):
    response = _upload(report_api.client, content=b"")

    assert response.status_code == 400


@pytest.mark.parametrize("failure", ["http", "timeout"])
def test_transcribe_maps_groq_http_and_timeout_errors_to_502(report_api, groq_mock, failure, caplog):
    if failure == "http":
        groq_mock.status_code = 502
    else:
        groq_mock.error = httpx.TimeoutException("request timed out")

    response = _upload(report_api.client)

    assert response.status_code == 502
    assert response.json()["detail"] == {"code": "transcription_failed"}
    assert "test-groq-key" not in caplog.text
    assert "audio-bytes" not in caplog.text


def test_transcribe_rejects_non_admin_before_calling_groq(report_api, groq_mock):
    response = _upload(report_api.client, role="Cajero")

    assert response.status_code == 403
    assert groq_mock.calls == []
