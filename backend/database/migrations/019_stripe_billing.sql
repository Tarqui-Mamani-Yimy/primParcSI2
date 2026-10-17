-- Stripe Billing integration. Re-runnable and additive by design.
BEGIN;

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "stripePriceId" VARCHAR(255);
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR(255);
ALTER TABLE "Suscripcion" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255);
ALTER TABLE "Suscripcion" ADD COLUMN IF NOT EXISTS "cancelaAlFinal" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS stripe_evento (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE stripe_evento TO app_role;

INSERT INTO permiso ("nombrePermiso") VALUES ('suscripcion.gestionar')
ON CONFLICT ("nombrePermiso") DO NOTHING;

INSERT INTO asignacion_permiso ("codigoRol", "idPermiso", "estado")
SELECT r."codigoRol", p."idPermiso", 'Activo'
FROM rol r CROSS JOIN permiso p
WHERE r."nombreRol" = 'Administrador' AND p."nombrePermiso" = 'suscripcion.gestionar'
ON CONFLICT ("codigoRol", "idPermiso") DO NOTHING;

-- Webhook access is transaction-local and only set by the server's verified
-- Stripe event handler; it cannot be requested through a client route.
DROP POLICY IF EXISTS tenant_isolation ON "Suscripcion";
CREATE POLICY tenant_isolation ON "Suscripcion"
USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true')
WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true');

COMMIT;
