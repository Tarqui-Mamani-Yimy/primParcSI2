from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventario, Movimiento


def adjust_inventory_and_record_movement(
    session: AsyncSession,
    inventory: Inventario,
    *,
    new_quantity: int,
    movement_quantity: int,
    movement_type: str,
    reason: str | None,
    reference: str | None = None,
) -> Movimiento:
    """Update a stock row and add its audit movement in the caller's transaction."""
    if new_quantity < 0:
        raise ValueError("Inventory quantity cannot be negative")
    inventory.cantidad_actual = new_quantity
    movement = Movimiento(
        idEmpresa=inventory.idEmpresa,
        tipo=movement_type,
        cantidad=movement_quantity,
        motivo=reason,
        referencia=reference,
        idInv=inventory.idInv,
    )
    session.add(movement)
    return movement
