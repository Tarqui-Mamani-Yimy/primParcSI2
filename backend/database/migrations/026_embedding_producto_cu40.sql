-- CU40 visual-search embeddings. Additive and re-runnable.
BEGIN;

CREATE TABLE IF NOT EXISTS embedding_producto (
    "idProducto" INTEGER PRIMARY KEY REFERENCES producto ("idProducto") ON DELETE CASCADE,
    "idEmpresa" INTEGER NOT NULL,
    vector REAL[] NOT NULL CHECK (cardinality(vector) = 2048),
    imagen_url TEXT NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embedding_producto_empresa
    ON embedding_producto ("idEmpresa");

ALTER TABLE embedding_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_producto FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON embedding_producto;
CREATE POLICY tenant_isolation ON embedding_producto
    USING ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
           OR current_setting('app.platform_admin', true) = 'true')
    WITH CHECK ("idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
                OR current_setting('app.platform_admin', true) = 'true');

GRANT SELECT, INSERT, UPDATE, DELETE ON embedding_producto TO app_role;

COMMIT;
