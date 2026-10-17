-- 016: monthly subscription prices (USD, same currency as Stripe payments).
-- Idempotent: only sets the agreed prices on the three seeded plans.
BEGIN;

UPDATE "Plan" SET "precioMensual" = 19.00 WHERE codigo = 'basico';
UPDATE "Plan" SET "precioMensual" = 49.00 WHERE codigo = 'intermedio';
UPDATE "Plan" SET "precioMensual" = 99.00 WHERE codigo = 'avanzado';

COMMIT;
