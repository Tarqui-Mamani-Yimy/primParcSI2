"""Provision Stripe test-mode products/prices from database plans."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Plan
from app.stripe_provider import list_prices, list_products, create_product, create_price


def _stripe_price(plan: Plan, api_key: str, cycle: str):
    lookup_key = f"{plan.codigo}_{cycle}"
    prices = list_prices(api_key=api_key, lookup_key=lookup_key)
    amount = plan.precioMensual if cycle == "mensual" else plan.precioAnual
    expected_amount = int(round(float(amount) * 100))
    interval = "month" if cycle == "mensual" else "year"
    matching = next((price for price in prices.data if price.currency == "usd"
                     and price.recurring and price.recurring.interval == interval
                     and price.unit_amount == expected_amount), None)
    if matching:
        return matching
    products = list_products(api_key=api_key)
    product = next((item for item in products.data
                    if item.metadata.to_dict().get("plan_codigo") == plan.codigo), None)
    if product is None:
        product = create_product(api_key=api_key, name=plan.nombre, metadata={"plan_codigo": plan.codigo})
    return create_price(api_key=api_key,
        product=product.id, currency="usd", unit_amount=expected_amount,
        recurring={"interval": interval}, lookup_key=lookup_key,
        transfer_lookup_key=True,
        metadata={"plan_codigo": plan.codigo},
    )


async def main():
    settings = get_settings()
    if not settings.STRIPE_SECRET_KEY:
        raise SystemExit("STRIPE_SECRET_KEY is required")
    if not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise SystemExit("Plan synchronization is restricted to Stripe test mode")
    async with AsyncSessionLocal() as session:
        plans = (await session.execute(select(Plan).order_by(Plan.idPlan))).scalars().all()
        for plan in plans:
            monthly = await asyncio.to_thread(_stripe_price, plan, settings.STRIPE_SECRET_KEY, "mensual")
            annual = await asyncio.to_thread(_stripe_price, plan, settings.STRIPE_SECRET_KEY, "anual")
            plan.stripePriceId = monthly.id
            plan.stripePriceIdAnual = annual.id
        await session.commit()
    print(f"Synchronized {len(plans)} Stripe test-mode plan prices")


if __name__ == "__main__":
    asyncio.run(main())
