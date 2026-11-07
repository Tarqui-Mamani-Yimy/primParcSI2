-- CU36 customer fit feedback. Additive and re-runnable.
BEGIN;

CREATE TABLE IF NOT EXISTS retroalimentacion_ajuste (
    "idRetro" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idCliente" INTEGER NOT NULL REFERENCES "Cliente" ("idCliente") ON DELETE CASCADE,
    "idProducto" INTEGER NOT NULL REFERENCES producto ("idProducto") ON DELETE CASCADE,
    talla VARCHAR(20) NOT NULL,
    resultado VARCHAR(10) NOT NULL CHECK (resultado IN ('pequena', 'bien', 'grande')),
    comentario VARCHAR(255) NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_retroalimentacion_cliente_producto UNIQUE ("idCliente", "idProducto")
);

CREATE INDEX IF NOT EXISTS idx_retroalimentacion_empresa_producto
    ON retroalimentacion_ajuste ("idEmpresa", "idProducto");

ALTER TABLE retroalimentacion_ajuste ENABLE ROW LEVEL SECURITY;
ALTER TABLE retroalimentacion_ajuste FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON retroalimentacion_ajuste;
CREATE POLICY tenant_isolation ON retroalimentacion_ajuste
    USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
           OR current_setting('app.platform_admin', true) = 'true')
    WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
                OR current_setting('app.platform_admin', true) = 'true');

GRANT SELECT, INSERT, UPDATE, DELETE ON retroalimentacion_ajuste TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

COMMIT;
