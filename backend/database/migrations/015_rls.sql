-- Tenant isolation for every table that carries the business discriminator.
-- The narrowly authorized platform session is transaction-local and is only
-- installed by app.database.get_platform_db after signed SuperAdmin permission.
BEGIN;

DO $$
DECLARE
    t TEXT;
    business_tables TEXT[] := ARRAY[
        'Proveedor', 'Temporada', 'metodo_pago', 'Usuario', 'Sucursal',
        'Colecciones', 'Cliente', 'Bitacora', 'producto', 'Recomendaciones',
        'Suscripcion', 'Reserva', 'Inventario', 'Movimiento', 'Venta',
        'detalle_venta', 'historial'
    ];
BEGIN
    FOREACH t IN ARRAY business_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        IF t = 'Usuario' THEN
            EXECUTE format(
                'CREATE POLICY tenant_isolation ON %I USING ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.auth_user_access'', true) = ''true'' OR current_setting(''app.platform_admin'', true) = ''true'') WITH CHECK ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR (current_setting(''app.auth_user_access'', true) = ''true'' AND ("idEmpresa" = 1 OR ("idEmpresa" IS NULL AND EXISTS (SELECT 1 FROM rol r WHERE r."codigoRol" = "Usuario"."codigoRol" AND r."nombreRol" = ''SuperAdmin'')))) OR current_setting(''app.platform_admin'', true) = ''true'')',
                t
            );
        ELSE
            EXECUTE format(
                'CREATE POLICY tenant_isolation ON %I USING ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'') WITH CHECK ("idEmpresa" = NULLIF(current_setting(''app.empresa_id'', true), '''')::integer OR current_setting(''app.platform_admin'', true) = ''true'')',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;
