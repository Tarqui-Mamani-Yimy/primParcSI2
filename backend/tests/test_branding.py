import asyncio
from types import SimpleNamespace

from app import email_utils
from app.main import app
from app.services import chat_gemini, recomendaciones_gemini
from app.routers import reports


def test_fastapi_metadata_uses_voguely_brand():
    assert app.title == "Voguely API"
    assert "Voguely" in app.description


def test_gemini_prompts_use_voguely_brand():
    assert "Voguely" in chat_gemini.SYSTEM_INSTRUCTION
    assert "YouShop" not in chat_gemini.SYSTEM_INSTRUCTION
    assert "Voguely" in chat_gemini._declaraciones_herramientas()[0].description
    assert "YouShop" not in chat_gemini._declaraciones_herramientas()[0].description
    assert "Voguely" in recomendaciones_gemini.SYSTEM_INSTRUCTION
    assert "YouShop" not in recomendaciones_gemini.SYSTEM_INSTRUCTION


def test_welcome_email_uses_voguely_brand(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

    def fake_post(_url, *, json, **_kwargs):
        captured.update(json)
        return Response()

    monkeypatch.setattr(
        email_utils,
        "settings",
        SimpleNamespace(
            BREVO_API_KEY="test-key",
            BREVO_SENDER_EMAIL="noreply@example.test",
            BREVO_SENDER_NAME="Voguely",
        ),
    )
    monkeypatch.setattr(email_utils.httpx, "post", fake_post)

    assert email_utils.send_reset_email("user@example.test", "https://example.test/reset", "Ana")
    assert captured["sender"]["name"] == "Voguely"
    assert captured["subject"] == "Bienvenida a Voguely: crea tu contraseña"
    assert "Gracias por elegir Voguely." in captured["textContent"]


def test_report_pdfs_use_voguely_brand(monkeypatch):
    titles = []

    def capture_pdf_title(title, *_args):
        titles.append(title)
        return b"pdf"

    monkeypatch.setattr(reports, "_build_pdf_bytes", capture_pdf_title)

    reports._sales_rows_to_pdf_bytes([], {})
    reports._inventory_rows_to_pdf_bytes([], {})

    assert titles == ["Voguely | Reporte de Ventas", "Voguely | Reporte de Inventario"]


def test_report_download_filenames_use_voguely_brand(monkeypatch):
    async def empty_sales(*_args):
        return []

    async def empty_inventory(*_args):
        return []

    monkeypatch.setattr(reports, "_consultar_ventas", empty_sales)
    monkeypatch.setattr(reports, "_consultar_inventario", empty_inventory)

    sales_csv = asyncio.run(reports.sales_report_csv(None, None, None, None, None, None))
    sales_pdf = asyncio.run(reports.sales_report_pdf(None, None, None, None, None, None))
    inventory_csv = asyncio.run(reports.inventory_report_csv(None, None, None, None))
    inventory_pdf = asyncio.run(reports.inventory_report_pdf(None, None, None, None))

    assert sales_csv.headers["content-disposition"] == 'attachment; filename="voguely_reporte_ventas.csv"'
    assert sales_pdf.headers["content-disposition"] == 'attachment; filename="voguely_reporte_ventas.pdf"'
    assert inventory_csv.headers["content-disposition"] == 'attachment; filename="voguely_reporte_inventario.csv"'
    assert inventory_pdf.headers["content-disposition"] == 'attachment; filename="voguely_reporte_inventario.pdf"'
