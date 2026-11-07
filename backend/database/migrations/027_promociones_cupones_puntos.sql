-- CU37/CU43 promotions, coupons, and loyalty points. Additive and rerunnable.
BEGIN;

CREATE TABLE IF NOT EXISTS promocion (
    "idPromocion" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo', 'nxm')),
    valor NUMERIC(12,2),
    n INTEGER,
    m INTEGER,
    alcance VARCHAR(20) NOT NULL CHECK (alcance IN ('todos', 'producto', 'coleccion', 'temporada', 'tipo')),
    alcance_ref VARCHAR(120),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_promocion_regla CHECK (
        (tipo = 'porcentaje' AND valor BETWEEN 1 AND 90 AND n IS NULL AND m IS NULL) OR
        (tipo = 'monto_fijo' AND valor > 0 AND n IS NULL AND m IS NULL) OR
        (tipo = 'nxm' AND valor IS NULL AND n > m AND m >= 1)
    ),
    CONSTRAINT chk_promocion_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_promocion_empresa_vigencia
    ON promocion ("idEmpresa", activa, fecha_inicio, fecha_fin);

CREATE TABLE IF NOT EXISTS cupon (
    "idCupon" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    codigo VARCHAR(30) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
    valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    minimo_compra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (minimo_compra >= 0),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    usos_maximos INTEGER CHECK (usos_maximos IS NULL OR usos_maximos > 0),
    un_uso_por_cliente BOOLEAN NOT NULL DEFAULT TRUE,
    "idCliente" INTEGER REFERENCES "Cliente"("idCliente") ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cupon_empresa_codigo UNIQUE ("idEmpresa", codigo),
    CONSTRAINT chk_cupon_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_cupon_empresa_codigo ON cupon ("idEmpresa", codigo);

CREATE TABLE IF NOT EXISTS cupon_uso (
    "idCuponUso" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idCupon" INTEGER NOT NULL REFERENCES cupon("idCupon") ON DELETE RESTRICT,
    "idVenta" INTEGER NOT NULL UNIQUE REFERENCES "Venta"("idVenta") ON DELETE CASCADE,
    "idCliente" INTEGER REFERENCES "Cliente"("idCliente") ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cupon_uso_cliente
    ON cupon_uso ("idEmpresa", "idCupon", "idCliente");

CREATE TABLE IF NOT EXISTS cuenta_puntos (
    "idCliente" INTEGER PRIMARY KEY REFERENCES "Cliente"("idCliente") ON DELETE CASCADE,
    "idEmpresa" INTEGER NOT NULL,
    saldo INTEGER NOT NULL DEFAULT 0 CHECK (saldo >= 0),
    acumulado_historico INTEGER NOT NULL DEFAULT 0 CHECK (acumulado_historico >= 0)
);

CREATE TABLE IF NOT EXISTS movimiento_puntos (
    "idMovimientoPuntos" SERIAL PRIMARY KEY,
    "idEmpresa" INTEGER NOT NULL,
    "idCliente" INTEGER NOT NULL REFERENCES "Cliente"("idCliente") ON DELETE CASCADE,
    "idVenta" INTEGER REFERENCES "Venta"("idVenta") ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ganado', 'canjeado', 'revertido', 'devuelto')),
    puntos INTEGER NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    nota TEXT
);
CREATE INDEX IF NOT EXISTS idx_movimiento_puntos_cliente_fecha
    ON movimiento_puntos ("idEmpresa", "idCliente", fecha);

ALTER TABLE "Venta"
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS descuento_promociones NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS descuento_cupon NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS descuento_puntos NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "idCupon" INTEGER REFERENCES cupon("idCupon") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS puntos_canjeados INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS puntos_ganados INTEGER NOT NULL DEFAULT 0;

ALTER TABLE detalle_venta
    ADD COLUMN IF NOT EXISTS precio_lista NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS "idPromocion" INTEGER REFERENCES promocion("idPromocion") ON DELETE SET NULL;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['promocion', 'cupon', 'cupon_uso', 'cuenta_puntos', 'movimiento_puntos']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'') WITH CHECK ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'')',
            table_name
        );
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_role', table_name);
    END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

INSERT INTO permiso ("nombrePermiso")
SELECT 'promocion.gestionar'
WHERE NOT EXISTS (
    SELECT 1 FROM permiso WHERE "nombrePermiso" = 'promocion.gestionar'
);

INSERT INTO asignacion_permiso ("codigoRol", "idPermiso", "fechaAsignacion", estado)
SELECT rol."codigoRol", permiso."idPermiso", now(), 'Activo'
FROM rol CROSS JOIN permiso
WHERE rol."nombreRol" = 'Administrador'
  AND permiso."nombrePermiso" = 'promocion.gestionar'
  AND NOT EXISTS (
      SELECT 1 FROM asignacion_permiso ap
      WHERE ap."codigoRol" = rol."codigoRol" AND ap."idPermiso" = permiso."idPermiso"
  );

COMMIT;
