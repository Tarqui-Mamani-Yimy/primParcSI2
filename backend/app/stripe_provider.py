"""Single adapter boundary for Stripe SDK operations."""
import stripe


StripeError = stripe.StripeError


def create_customer(*, api_key: str, name: str, metadata: dict):
    return stripe.Customer.create(name=name, metadata=metadata, api_key=api_key)


def create_checkout_session(*, api_key: str, **params):
    return stripe.checkout.Session.create(**params, api_key=api_key)


def create_portal_session(*, api_key: str, customer: str, return_url: str):
    return stripe.billing_portal.Session.create(customer=customer, return_url=return_url, api_key=api_key)


def retrieve_subscription(*, api_key: str, subscription_id: str):
    return stripe.Subscription.retrieve(subscription_id, api_key=api_key)


def subscription_period_end(subscription) -> int | None:
    """Normalize period end across Stripe SDK object and API-version shapes."""
    period_end = getattr(subscription, "current_period_end", None)
    if period_end:
        return period_end
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) if items is not None else None
    if not data and isinstance(subscription, dict):
        items = subscription.get("items") or {}
        data = items.get("data") or [] if isinstance(items, dict) else getattr(items, "data", None)
    if data:
        first = data[0]
        return getattr(first, "current_period_end", None) or (first.get("current_period_end") if isinstance(first, dict) else None)
    return None


def update_subscription(*, api_key: str, subscription_id: str, items: list, proration_behavior: str):
    return stripe.Subscription.modify(subscription_id, items=items,
                                      proration_behavior=proration_behavior, api_key=api_key)


def create_payment_intent(*, api_key: str, **params):
    return stripe.PaymentIntent.create(**params, api_key=api_key)


def retrieve_payment_intent(*, api_key: str, payment_intent_id: str):
    return stripe.PaymentIntent.retrieve(payment_intent_id, api_key=api_key)


def create_refund(*, api_key: str, **params):
    return stripe.Refund.create(**params, api_key=api_key)


def retrieve_refund(*, api_key: str, refund_id: str):
    return stripe.Refund.retrieve(refund_id, api_key=api_key)


def list_prices(*, api_key: str, lookup_key: str):
    return stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=100, api_key=api_key)


def list_products(*, api_key: str):
    return stripe.Product.list(active=True, limit=100, api_key=api_key)


def create_product(*, api_key: str, name: str, metadata: dict):
    return stripe.Product.create(name=name, metadata=metadata, api_key=api_key)


def create_price(*, api_key: str, **params):
    return stripe.Price.create(**params, api_key=api_key)
