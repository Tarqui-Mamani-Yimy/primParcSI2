-- CU31 returns and exchanges. Additive and re-runnable; do not modify base.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS devolucion (
    "idDevolucion" BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idVenta" INTEGER NOT NULL REFERENCES "Venta" ("idVenta") ON UPDATE CASCADE,
    "idUser" INTEGER NOT NULL REFERENCES "Usuario" ("idUser") ON UPDATE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('devolucion', 'cambio')),
    estado VARCHAR(30) NOT NULL CHECK (estado IN ('payment_pending', 'completed', 'payment_failed')),
    "montoReembolso" NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK ("montoReembolso" >= 0),
    "montoCobrado" NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK ("montoCobrado" >= 0),
    "metodoPago" VARCHAR(30),
    "stripeRefundId" VARCHAR(255),
    "stripeRefundAttempts" INTEGER NOT NULL DEFAULT 0 CHECK ("stripeRefundAttempts" >= 0),
    "stripePaymentIntentId" VARCHAR(255),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_devolucion_empresa_id UNIQUE ("idEmpresa", "idDevolucion")
);

CREATE TABLE IF NOT EXISTS devolucion_detalle (
    id BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    return_id BIGINT NOT NULL REFERENCES devolucion ("idDevolucion") ON DELETE CASCADE,
    sale_item_id INTEGER NOT NULL REFERENCES detalle_venta ("codigoVenta") ON UPDATE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    inventory_id INTEGER NOT NULL REFERENCES "Inventario" ("idInv") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS devolucion_reemplazo (
    id BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    return_id BIGINT NOT NULL REFERENCES devolucion ("idDevolucion") ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES producto ("idProducto") ON UPDATE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    inventory_id INTEGER NOT NULL REFERENCES "Inventario" ("idInv") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS movimiento_caja (
    id BIGSERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    return_id BIGINT NOT NULL REFERENCES devolucion ("idDevolucion") ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES "Sucursal" ("codigoSucursal") ON UPDATE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "Usuario" ("idUser") ON UPDATE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('ingreso', 'egreso')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    concept VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devolucion_empresa_fecha ON devolucion ("idEmpresa", fecha DESC);
CREATE INDEX IF NOT EXISTS idx_devolucion_venta ON devolucion ("idEmpresa", "idVenta");
CREATE INDEX IF NOT EXISTS idx_devolucion_detalle_sale_item ON devolucion_detalle ("idEmpresa", sale_item_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_reemplazo_return ON devolucion_reemplazo ("idEmpresa", return_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_caja_return ON movimiento_caja ("idEmpresa", return_id);

DO $$
DECLARE table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['devolucion', 'devolucion_detalle', 'devolucion_reemplazo', 'movimiento_caja'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'') WITH CHECK ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'')',
            table_name
        );
    END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON devolucion, devolucion_detalle, devolucion_reemplazo, movimiento_caja TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

INSERT INTO "permiso" ("nombrePermiso")
VALUES ('devolucion.ver'), ('devolucion.gestionar')
ON CONFLICT ("nombrePermiso") DO NOTHING;

INSERT INTO "asignacion_permiso" ("codigoRol", "idPermiso")
SELECT r."codigoRol", p."idPermiso"
FROM "rol" AS r
CROSS JOIN "permiso" AS p
WHERE r."nombreRol" IN ('Administrador', 'Encargado de Sucursal', 'Cajero')
  AND p."nombrePermiso" IN ('devolucion.ver', 'devolucion.gestionar')
ON CONFLICT ("codigoRol", "idPermiso") DO NOTHING;

COMMIT;
