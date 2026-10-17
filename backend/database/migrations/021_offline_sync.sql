-- Additive offline synchronization metadata and idempotency persistence.
BEGIN;

ALTER TABLE producto ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'online';
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "comprobanteLocal" VARCHAR(100);
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "discrepanciaStock" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "discrepanciaResueltaEn" TIMESTAMPTZ;
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "discrepanciaNota" TEXT;
-- The existing inventory check blocks offline POS reconciliation, where a
-- counted/real-world sale may legitimately expose negative stock.
ALTER TABLE "Inventario" DROP CONSTRAINT IF EXISTS chk_inv_cantidades;
ALTER TABLE "Inventario" ADD CONSTRAINT chk_inv_cantidades CHECK (cantidad_reservada >= 0);

CREATE TABLE IF NOT EXISTS sync_borrado (
    idBorrado BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    tabla VARCHAR(40) NOT NULL,
    "idRegistro" BIGINT NOT NULL,
    "borradoEn" TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sync_borrado ADD COLUMN IF NOT EXISTS "idCliente" INTEGER;
CREATE INDEX IF NOT EXISTS idx_sync_borrado_tenant_time ON sync_borrado ("idEmpresa", "borradoEn");
CREATE TABLE IF NOT EXISTS operacion_idempotente (
    "idOperacion" BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idUser" INTEGER NOT NULL,
    clave VARCHAR(255) NOT NULL,
    metodo VARCHAR(10) NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    "hashBody" VARCHAR(64) NOT NULL,
    status INTEGER NOT NULL,
    respuesta JSONB NOT NULL,
    "creadoEn" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_operacion_idempotente_scope UNIQUE ("idEmpresa", "idUser", clave)
);

CREATE OR REPLACE FUNCTION sync_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW."fechaActualizacion" = now(); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION sync_record_delete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE company_id INTEGER; record_id BIGINT;
BEGIN
    company_id := OLD."idEmpresa";
    EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO record_id USING OLD;
    INSERT INTO sync_borrado("idEmpresa", tabla, "idRegistro", "idCliente")
    VALUES (company_id, TG_TABLE_NAME, record_id,
      CASE WHEN TG_TABLE_NAME IN ('Reserva', 'Venta') THEN (to_jsonb(OLD)->>'idCliente')::integer ELSE NULL END);
    RETURN OLD;
END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['producto','Sucursal','Inventario','Reserva','Venta','Cliente'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_sync_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_touch_updated_at()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_delete ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_sync_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sync_record_delete(%L)', t,
      CASE t WHEN 'producto' THEN 'idProducto' WHEN 'Sucursal' THEN 'codigoSucursal'
        WHEN 'Inventario' THEN 'idInv' WHEN 'Reserva' THEN 'codigoReserva'
        WHEN 'Venta' THEN 'idVenta' WHEN 'Cliente' THEN 'idCliente' END);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'') WITH CHECK ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'')', t);
  END LOOP;
END $$;

ALTER TABLE sync_borrado ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_borrado FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sync_borrado;
CREATE POLICY tenant_isolation ON sync_borrado USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer OR current_setting('app.platform_admin', true) = 'true') WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer OR current_setting('app.platform_admin', true) = 'true');
ALTER TABLE operacion_idempotente ENABLE ROW LEVEL SECURITY;
ALTER TABLE operacion_idempotente FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON operacion_idempotente;
CREATE POLICY tenant_isolation ON operacion_idempotente USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer OR current_setting('app.platform_admin', true) = 'true') WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer OR current_setting('app.platform_admin', true) = 'true');
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_borrado, operacion_idempotente TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

COMMIT;
