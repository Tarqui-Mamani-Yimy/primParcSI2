-- Customer return requests (S1-S3); additive and safe to reapply.
BEGIN;

CREATE TABLE IF NOT EXISTS solicitud_devolucion (
    "idDevolucion" BIGINT PRIMARY KEY
        REFERENCES devolucion ("idDevolucion") ON DELETE CASCADE,
    "idEmpresa" INTEGER NOT NULL,
    "idCliente" INTEGER NOT NULL
        REFERENCES "Cliente" ("idCliente"),
    estado VARCHAR(20) NOT NULL DEFAULT 'solicitada',
    motivo TEXT NOT NULL,
    "motivoRechazo" TEXT,
    banco VARCHAR(120) NOT NULL,
    "numeroCuenta" VARCHAR(120) NOT NULL,
    "titularCuenta" VARCHAR(160) NOT NULL,
    "comprobanteTransferencia" VARCHAR(160),
    "fechaReembolso" TIMESTAMPTZ,
    "montoReembolso" NUMERIC(12, 2) NOT NULL,
    "fechaSolicitud" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Match devolucion."idDevolucion" (BIGINT) when an earlier run created it as INTEGER.
ALTER TABLE solicitud_devolucion ALTER COLUMN "idDevolucion" TYPE BIGINT;

CREATE INDEX IF NOT EXISTS idx_solicitud_devolucion_empresa_estado
    ON solicitud_devolucion ("idEmpresa", estado);
CREATE INDEX IF NOT EXISTS idx_solicitud_devolucion_cliente
    ON solicitud_devolucion ("idEmpresa", "idCliente");

ALTER TABLE solicitud_devolucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_devolucion FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'solicitud_devolucion'
          AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON solicitud_devolucion
        USING (
            "idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
            OR current_setting('app.platform_admin', true) = 'true'
        )
        WITH CHECK (
            "idEmpresa" = NULLIF(current_setting('app.empresa_id', true), '')::integer
            OR current_setting('app.platform_admin', true) = 'true'
        );
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON solicitud_devolucion TO app_role;

INSERT INTO "permiso" ("nombrePermiso")
VALUES ('devolucion.solicitar')
ON CONFLICT ("nombrePermiso") DO NOTHING;

INSERT INTO "asignacion_permiso" ("codigoRol", "idPermiso")
SELECT r."codigoRol", p."idPermiso"
FROM "rol" AS r
CROSS JOIN "permiso" AS p
WHERE r."nombreRol" = 'Cliente'
  AND p."nombrePermiso" = 'devolucion.solicitar'
ON CONFLICT ("codigoRol", "idPermiso") DO NOTHING;

COMMIT;
