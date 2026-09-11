"""Router generico de pagos con tarjeta via Stripe.

No conoce `Venta` ni `Reserva`: solo crea/verifica Payment Intents y, cuando
Stripe confirma un cobro como `succeeded`, escribe una fila en `metodo_pago`
que el llamante (venta, reserva) puede usar despues como un `idMetPago`
ordinario. El monto SIEMPRE se calcula aqui, del lado servidor, a partir de
`Producto.venta` — nunca del valor `amount` que pudiera mandar el cliente.
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MetodoPago, Producto
from app.schemas.fase2 import PagoIntentIn, PagoIntentOut, PagoIntentVerificadoOut
from app.security import require_permiso
from app.services.pagos_stripe import (
    StripeNoConfigurado,
    StripePagoError,
    crear_payment_intent,
    obtener_payment_intent,
    stripe_configurado,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _requerir_stripe_configurado() -> None:
    if not stripe_configurado():
        raise HTTPException(
            status_code=503,
            detail="El cobro con tarjeta no esta disponible: Stripe no esta configurado en este servidor",
        )


@router.post("/intents", response_model=PagoIntentOut, status_code=201)
async def create_payment_intent(
    payload: PagoIntentIn,
    session: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_permiso("venta.crear")),
):
    _requerir_stripe_configurado()

    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un item")

    total = Decimal("0")
    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="cantidad debe ser > 0")
        producto = await session.get(Producto, item.idProducto)
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto {item.idProducto} inexistente")
        total += Decimal(str(producto.venta)) * item.cantidad

    id_user = int(auth["sub"])
    clave_idempotencia = f"pi:{id_user}:{payload.claveIntento}"
    metadata = {"idUser": str(id_user), "concepto": payload.concepto or ""}

    try:
        intent = await crear_payment_intent(
            monto_usd=total,
            clave_idempotencia=clave_idempotencia,
            metadata=metadata,
        )
    except StripeNoConfigurado:
        raise HTTPException(status_code=503, detail="Stripe no esta configurado en este servidor")
    except StripePagoError:
        raise HTTPException(status_code=502, detail="No se pudo crear el intento de pago con Stripe")

    return PagoIntentOut(
        paymentIntentId=intent["id"],
        clientSecret=intent["client_secret"],
        monto=float(total),
    )


@router.post("/intents/{payment_intent_id}/verify", response_model=PagoIntentVerificadoOut)
async def verify_payment_intent(
    payment_intent_id: str,
    session: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_permiso("venta.crear")),
):
    _requerir_stripe_configurado()

    try:
        intent = await obtener_payment_intent(payment_intent_id)
    except StripeNoConfigurado:
        raise HTTPException(status_code=503, detail="Stripe no esta configurado en este servidor")
    except StripePagoError:
        raise HTTPException(status_code=502, detail="No se pudo verificar el intento de pago con Stripe")

    if intent["status"] != "succeeded":
        return PagoIntentVerificadoOut(
            paymentIntentId=intent["id"],
            estado=intent["status"],
            pagado=False,
        )

    existente = (
        await session.execute(
            select(MetodoPago).where(MetodoPago.stripePaymentIntentId == intent["id"])
        )
    ).scalar_one_or_none()

    if existente is not None:
        return PagoIntentVerificadoOut(
            paymentIntentId=intent["id"],
            estado=intent["status"],
            pagado=True,
            idMetPago=existente.idMetPago,
            monto=float(existente.monto),
        )

    monto_recibido = Decimal(str(intent["amount_received"] or 0)) / Decimal(100)
    metodo = MetodoPago(
        tipo="Tarjeta (Stripe)",
        estado="Activo",
        monto=float(monto_recibido),
        stripePaymentIntentId=intent["id"],
        moneda=intent.get("currency"),
        estadoStripe=intent["status"],
        origen="tarjeta_stripe",
    )
    session.add(metodo)
    await session.commit()
    await session.refresh(metodo)

    return PagoIntentVerificadoOut(
        paymentIntentId=intent["id"],
        estado=intent["status"],
        pagado=True,
        idMetPago=metodo.idMetPago,
        monto=float(metodo.monto),
    )
