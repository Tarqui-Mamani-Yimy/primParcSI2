-- CU34 product-specific garment measurements. Additive and re-runnable.
BEGIN;

CREATE TABLE IF NOT EXISTS medida_producto (
    "idMedida" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL REFERENCES producto ("idProducto") ON DELETE CASCADE,
    talla VARCHAR(20) NOT NULL,
    pecho NUMERIC(5, 1) NULL CHECK (pecho IS NULL OR pecho > 0),
    largo NUMERIC(5, 1) NULL CHECK (largo IS NULL OR largo > 0),
    hombros NUMERIC(5, 1) NULL CHECK (hombros IS NULL OR hombros > 0),
    manga NUMERIC(5, 1) NULL CHECK (manga IS NULL OR manga > 0),
    cintura NUMERIC(5, 1) NULL CHECK (cintura IS NULL OR cintura > 0),
    cadera NUMERIC(5, 1) NULL CHECK (cadera IS NULL OR cadera > 0),
    CONSTRAINT uq_medida_producto_talla UNIQUE ("idProducto", talla)
);

ALTER TABLE medida_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE medida_producto FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON medida_producto;
CREATE POLICY tenant_isolation ON medida_producto
    USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
           OR current_setting('app.platform_admin', true) = 'true')
    WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
                OR current_setting('app.platform_admin', true) = 'true');

GRANT SELECT, INSERT, UPDATE, DELETE ON medida_producto TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

COMMIT;
