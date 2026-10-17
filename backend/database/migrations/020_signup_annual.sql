-- Self-service signup and immutable monthly/yearly Stripe prices.
BEGIN;

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "precioAnual" NUMERIC(12, 2);
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "stripePriceIdAnual" VARCHAR(255);
ALTER TABLE "Suscripcion" ADD COLUMN IF NOT EXISTS "ciclo" VARCHAR(10) NOT NULL DEFAULT 'mensual';

UPDATE "Plan" SET "precioMensual" = CASE "codigo"
    WHEN 'basico' THEN 290 WHEN 'intermedio' THEN 690 WHEN 'avanzado' THEN 1490
    ELSE "precioMensual" END,
    "precioAnual" = CASE "codigo"
    WHEN 'basico' THEN 2784 WHEN 'intermedio' THEN 6624 WHEN 'avanzado' THEN 14304
    ELSE COALESCE("precioAnual", "precioMensual" * 12) END;

ALTER TABLE "Plan" ALTER COLUMN "precioAnual" SET NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "precioAnual" SET DEFAULT 0;
ALTER TABLE "Suscripcion" DROP CONSTRAINT IF EXISTS chk_suscripcion_ciclo;
ALTER TABLE "Suscripcion" ADD CONSTRAINT chk_suscripcion_ciclo CHECK ("ciclo" IN ('mensual', 'anual'));

CREATE TABLE IF NOT EXISTS signup_conflicto (
    checkout_session_id VARCHAR(255) PRIMARY KEY,
    correo VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
GRANT SELECT, INSERT ON TABLE signup_conflicto TO app_role;

-- Webhook transaction context is server-installed only. Extend it to account
-- rows while preserving all ordinary tenant/auth/platform policy predicates.
DROP POLICY IF EXISTS tenant_isolation ON "Empresa";
CREATE POLICY tenant_isolation ON "Empresa"
USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true')
WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true');

DROP POLICY IF EXISTS tenant_isolation ON "Usuario";
CREATE POLICY tenant_isolation ON "Usuario"
USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR current_setting('app.auth_user_access', true) = 'true'
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true')
WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
    OR (current_setting('app.auth_user_access', true) = 'true' AND
        ("idEmpresa" = 1 OR ("idEmpresa" IS NULL AND EXISTS (
            SELECT 1 FROM rol r WHERE r."codigoRol" = "Usuario"."codigoRol" AND r."nombreRol" = 'SuperAdmin'))))
    OR current_setting('app.platform_admin', true) = 'true'
    OR current_setting('app.billing_webhook', true) = 'true');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Plan", "Suscripcion", "Empresa", "Usuario" TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;
COMMIT;
