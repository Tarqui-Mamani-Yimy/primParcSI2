from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ReturnItemIn(BaseModel):
    sale_item_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class CreateReturnIn(BaseModel):
    sale_id: int = Field(gt=0)
    items: list[ReturnItemIn] = Field(min_length=1)


class CreateExchangeIn(BaseModel):
    sale_id: int = Field(gt=0)
    sale_item_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    replacement_product_id: int = Field(gt=0)
    replacement_quantity: int = Field(default=1, gt=0)


class ReturnableItemOut(BaseModel):
    sale_item_id: int
    product_id: int
    product_name: str
    sold_quantity: int
    returned_quantity: int
    returnable_quantity: int
    unit_price: Decimal


class ReturnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_id: int
    type: str
    status: str
    refund_amount: Decimal
    amount_due: Decimal
    payment_method: str | None = None
    payment_intent_id: str | None = None
    client_secret: str | None = None
    stripe_refund_id: str | None = None
    created_at: datetime


class ReturnDetailOut(ReturnOut):
    items: list[dict] = Field(default_factory=list)
    replacements: list[dict] = Field(default_factory=list)
