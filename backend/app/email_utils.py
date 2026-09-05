import logging
import smtplib
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_reset_email(to_email: str, reset_link: str) -> bool:
    """Envia el correo de recuperacion de contrasena por SMTP.

    Devuelve True si el correo se envio, False si SMTP no esta configurado
    o si ocurrio un error al enviarlo (en ambos casos el llamador debe caer
    al modo desarrollo devolviendo el token directamente en la respuesta).
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    remitente = settings.SMTP_FROM or settings.SMTP_USER

    cuerpo = (
        "Recibimos una solicitud para restablecer tu contrasena.\n\n"
        f"Haz clic en el siguiente enlace para continuar:\n{reset_link}\n\n"
        "Si no solicitaste esto, puedes ignorar este correo. "
        "El enlace expira en 15 minutos."
    )
    mensaje = MIMEText(cuerpo, "plain", "utf-8")
    mensaje["Subject"] = "Restablece tu contrasena"
    mensaje["From"] = remitente
    mensaje["To"] = to_email

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(remitente, [to_email], mensaje.as_string())
        return True
    except Exception:
        logger.exception("No se pudo enviar el correo de recuperacion a %s", to_email)
        return False
