-- Multi-tenant foundation. Shared/global lookup and RBAC tables (Ciudad, rol,
-- permiso, asignacion_permiso) intentionally remain platform-wide.
BEGIN;

CREATE TABLE IF NOT EXISTS "Plan" (
    "idPlan" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "codigo" VARCHAR(30) NOT NULL UNIQUE,
    "nombre" VARCHAR(50) NOT NULL,
    "precioMensual" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "limites" JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT "chk_plan_precio" CHECK ("precioMensual" >= 0)
);

CREATE TABLE IF NOT EXISTS "Empresa" (
    "idEmpresa" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL UNIQUE,
    "logoUrl" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chk_empresa_estado" CHECK ("estado" IN ('activa', 'suspendida'))
);

CREATE TABLE IF NOT EXISTS "Suscripcion" (
    "idSuscripcion" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "idEmpresa" INT NOT NULL,
    "idPlan" INT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "fechaInicio" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fechaFin" DATE,
    CONSTRAINT "fk_suscripcion_empresa" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa" ("idEmpresa"),
    CONSTRAINT "fk_suscripcion_plan" FOREIGN KEY ("idPlan") REFERENCES "Plan" ("idPlan"),
    CONSTRAINT "chk_suscripcion_estado" CHECK ("estado" IN ('activa', 'vencida', 'suspendida')),
    CONSTRAINT "uq_suscripcion_empresa" UNIQUE ("idEmpresa")
);

INSERT INTO "Plan" ("codigo", "nombre", "precioMensual", "features", "limites") VALUES
('basico', 'Básico', 0, '["pos","inventario","ventas","reportes"]'::jsonb,
 '{"sucursales":1,"usuarios":3,"productos":200}'::jsonb),
('intermedio', 'Intermedio', 0,
 '["pos","inventario","ventas","reportes","despachos","reservas","pagos_online","app_movil","reportes_avanzados"]'::jsonb,
 '{"sucursales":5,"usuarios":15,"productos":2000}'::jsonb),
('avanzado', 'Avanzado', 0,
 '["pos","inventario","ventas","reportes","despachos","reservas","pagos_online","app_movil","reportes_avanzados","reportes_export","ia","probador"]'::jsonb,
 '{"sucursales":null,"usuarios":null,"productos":null}'::jsonb)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "Empresa" ("idEmpresa", "nombre", "slug", "estado")
OVERRIDING SYSTEM VALUE VALUES (1, 'YouShop', 'youshop', 'activa')
ON CONFLICT ("idEmpresa") DO NOTHING;

-- Keep the identity sequence ahead of the explicit legacy tenant id.
SELECT setval(pg_get_serial_sequence('"Empresa"', 'idEmpresa'),
              GREATEST((SELECT COALESCE(MAX("idEmpresa"), 1) FROM "Empresa"), 1), true);

INSERT INTO "Suscripcion" ("idEmpresa", "idPlan", "estado", "fechaInicio")
SELECT 1, p."idPlan", 'activa', CURRENT_DATE FROM "Plan" p WHERE p."codigo" = 'avanzado'
ON CONFLICT ("idEmpresa") DO NOTHING;

-- These are tenant-owned business tables. Usuario is nullable only to allow
-- the platform-wide SuperAdmin account; existing users are assigned to tenant 1.
ALTER TABLE "Proveedor" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Temporada" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "metodo_pago" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Colecciones" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Bitacora" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Recomendaciones" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "detalle_venta" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;
ALTER TABLE "historial" ADD COLUMN IF NOT EXISTS "idEmpresa" INT;

UPDATE "Proveedor" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Temporada" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "metodo_pago" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Usuario" u SET "idEmpresa" = 1 WHERE u."idEmpresa" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "rol" r WHERE r."nombreRol" = 'SuperAdmin' AND r."codigoRol" = u."codigoRol");
UPDATE "Sucursal" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Colecciones" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Cliente" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Bitacora" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "producto" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Recomendaciones" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Reserva" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Inventario" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Movimiento" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "Venta" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "detalle_venta" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;
UPDATE "historial" SET "idEmpresa" = 1 WHERE "idEmpresa" IS NULL;

ALTER TABLE "Proveedor" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Temporada" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "metodo_pago" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Sucursal" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Colecciones" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Cliente" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Bitacora" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "producto" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Recomendaciones" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Reserva" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Inventario" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Movimiento" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "Venta" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "detalle_venta" ALTER COLUMN "idEmpresa" SET NOT NULL;
ALTER TABLE "historial" ALTER COLUMN "idEmpresa" SET NOT NULL;

DO $$
DECLARE t RECORD;
BEGIN
    FOR t IN SELECT * FROM (VALUES
        ('Proveedor', 'fk_proveedor_empresa'), ('Temporada', 'fk_temporada_empresa'),
        ('metodo_pago', 'fk_metodo_pago_empresa'), ('Usuario', 'fk_usuario_empresa'),
        ('Sucursal', 'fk_sucursal_empresa'), ('Colecciones', 'fk_colecciones_empresa'),
        ('Cliente', 'fk_cliente_empresa'), ('Bitacora', 'fk_bitacora_empresa'),
        ('producto', 'fk_producto_empresa'), ('Recomendaciones', 'fk_recomendaciones_empresa'),
        ('Reserva', 'fk_reserva_empresa'), ('Inventario', 'fk_inventario_empresa'),
        ('Movimiento', 'fk_movimiento_empresa'), ('Venta', 'fk_venta_empresa'),
        ('detalle_venta', 'fk_detalle_venta_empresa'), ('historial', 'fk_historial_empresa')
    ) AS x(table_name, constraint_name)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t.constraint_name AND conrelid = format('%I', t.table_name)::regclass) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("idEmpresa") REFERENCES "Empresa" ("idEmpresa")', t.table_name, t.constraint_name);
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS "idx_proveedor_empresa" ON "Proveedor" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_temporada_empresa" ON "Temporada" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_metodo_pago_empresa" ON "metodo_pago" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_usuario_empresa" ON "Usuario" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_sucursal_empresa" ON "Sucursal" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_colecciones_empresa" ON "Colecciones" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_cliente_empresa" ON "Cliente" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_bitacora_empresa" ON "Bitacora" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_producto_empresa" ON "producto" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_recomendaciones_empresa" ON "Recomendaciones" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_reserva_empresa" ON "Reserva" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_inventario_empresa" ON "Inventario" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_movimiento_empresa" ON "Movimiento" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_venta_empresa" ON "Venta" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_detalle_venta_empresa" ON "detalle_venta" ("idEmpresa");
CREATE INDEX IF NOT EXISTS "idx_historial_empresa" ON "historial" ("idEmpresa");

-- Tenant-qualified alternate keys support composite FKs in later migrations.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inventario_empresa_sucursal_producto" ON "Inventario" ("idEmpresa", "codigoSucursal", "idProducto");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_usuario_empresa_id" ON "Usuario" ("idEmpresa", "idUser");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cliente_empresa_id" ON "Cliente" ("idEmpresa", "idCliente");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sucursal_empresa_id" ON "Sucursal" ("idEmpresa", "codigoSucursal");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_producto_empresa_id" ON "producto" ("idEmpresa", "idProducto");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_metodo_pago_empresa_id" ON "metodo_pago" ("idEmpresa", "idMetPago");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_temporada_empresa_id" ON "Temporada" ("idEmpresa", "idTemporada");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_colecciones_empresa_id" ON "Colecciones" ("idEmpresa", "idColeccion");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_proveedor_empresa_id" ON "Proveedor" ("idEmpresa", "idProveedor");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_venta_empresa_id" ON "Venta" ("idEmpresa", "idVenta");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reserva_empresa_id" ON "Reserva" ("idEmpresa", "codigoReserva");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bitacora_empresa_id" ON "Bitacora" ("idEmpresa", "idBitacora");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_recomendaciones_empresa_id" ON "Recomendaciones" ("idEmpresa", "idRecomendacion");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inventario_empresa_id" ON "Inventario" ("idEmpresa", "idInv");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_movimiento_empresa_id" ON "Movimiento" ("idEmpresa", "idMov");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_detalle_venta_empresa_id" ON "detalle_venta" ("idEmpresa", "codigoVenta");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_historial_empresa_id" ON "historial" ("idEmpresa", "codigoHistorial");

-- Qualify business-to-business references by tenant as well. The original
-- globally-unique IDs remain intact; these alternate keys prevent cross-tenant
-- references even if a caller accidentally supplies another company's ID.
DO $$
DECLARE f RECORD;
BEGIN
    FOR f IN SELECT * FROM (VALUES
        ('Colecciones','fk_colecciones_tenant_temporada','"idEmpresa", "idTemporada"','"Temporada"','"idEmpresa", "idTemporada"'),
        ('metodo_pago','fk_metodo_pago_tenant_sucursal','"idEmpresa", "codigoSucursal"','"Sucursal"','"idEmpresa", "codigoSucursal"'),
        ('metodo_pago','fk_metodo_pago_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('metodo_pago','fk_metodo_pago_tenant_usuario','"idEmpresa", "idUserPago"','"Usuario"','"idEmpresa", "idUser"'),
        ('producto','fk_producto_tenant_proveedor','"idEmpresa", "idProveedor"','"Proveedor"','"idEmpresa", "idProveedor"'),
        ('producto','fk_producto_tenant_coleccion','"idEmpresa", "idColeccion"','"Colecciones"','"idEmpresa", "idColeccion"'),
        ('Cliente','fk_cliente_tenant_usuario','"idEmpresa", "idUser"','"Usuario"','"idEmpresa", "idUser"'),
        ('Bitacora','fk_bitacora_tenant_usuario','"idEmpresa", "idUser"','"Usuario"','"idEmpresa", "idUser"'),
        ('Recomendaciones','fk_recomendaciones_tenant_cliente','"idEmpresa", "idCliente"','"Cliente"','"idEmpresa", "idCliente"'),
        ('Recomendaciones','fk_recomendaciones_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('Reserva','fk_reserva_tenant_cliente','"idEmpresa", "idCliente"','"Cliente"','"idEmpresa", "idCliente"'),
        ('Reserva','fk_reserva_tenant_sucursal','"idEmpresa", "codigoSucursal"','"Sucursal"','"idEmpresa", "codigoSucursal"'),
        ('Reserva','fk_reserva_tenant_metodo_pago','"idEmpresa", "idMetPago"','metodo_pago','"idEmpresa", "idMetPago"'),
        ('Reserva','fk_reserva_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('Inventario','fk_inventario_tenant_sucursal','"idEmpresa", "codigoSucursal"','"Sucursal"','"idEmpresa", "codigoSucursal"'),
        ('Inventario','fk_inventario_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('Movimiento','fk_movimiento_tenant_inventario','"idEmpresa", "idInv"','"Inventario"','"idEmpresa", "idInv"'),
        ('Venta','fk_venta_tenant_cliente','"idEmpresa", "idCliente"','"Cliente"','"idEmpresa", "idCliente"'),
        ('Venta','fk_venta_tenant_metodo_pago','"idEmpresa", "idMetPago"','metodo_pago','"idEmpresa", "idMetPago"'),
        ('detalle_venta','fk_detalle_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('detalle_venta','fk_detalle_tenant_venta','"idEmpresa", "idVenta"','"Venta"','"idEmpresa", "idVenta"'),
        ('detalle_venta','fk_detalle_tenant_reserva','"idEmpresa", "codigoReserva"','"Reserva"','"idEmpresa", "codigoReserva"'),
        ('historial','fk_historial_tenant_producto','"idEmpresa", "idProducto"','producto','"idEmpresa", "idProducto"'),
        ('historial','fk_historial_tenant_cliente','"idEmpresa", "idCliente"','"Cliente"','"idEmpresa", "idCliente"'),
        ('historial','fk_historial_tenant_venta','"idEmpresa", "idVenta"','"Venta"','"idEmpresa", "idVenta"')
    ) AS x(table_name, constraint_name, source_cols, target_table, target_cols)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = f.constraint_name AND conrelid = format('%I', f.table_name)::regclass) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s)',
                f.table_name, f.constraint_name, f.source_cols, f.target_table, f.target_cols);
        END IF;
    END LOOP;
END $$;

-- RBAC remains global; the platform role and permission are shared records.
INSERT INTO "rol" ("nombreRol") VALUES ('SuperAdmin') ON CONFLICT ("nombreRol") DO NOTHING;
INSERT INTO "permiso" ("nombrePermiso") VALUES ('plataforma.admin') ON CONFLICT ("nombrePermiso") DO NOTHING;
INSERT INTO "asignacion_permiso" ("codigoRol", "idPermiso")
SELECT r."codigoRol", p."idPermiso" FROM "rol" r CROSS JOIN "permiso" p
WHERE r."nombreRol" = 'SuperAdmin' AND p."nombrePermiso" = 'plataforma.admin'
ON CONFLICT ("codigoRol", "idPermiso") DO NOTHING;

COMMIT;
