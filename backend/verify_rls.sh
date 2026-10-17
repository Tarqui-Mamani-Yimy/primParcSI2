#!/usr/bin/env bash
set -euo pipefail

# Transactional smoke check. DATABASE_URL must point to the non-superuser,
# NOBYPASSRLS application role. It inserts a temporary company and Usuario,
# checks RLS visibility, then rolls both rows back.
: "${DATABASE_URL:?Set DATABASE_URL to the application-role connection string}"

case "$DATABASE_URL" in
  postgresql+asyncpg://*) PSQL_DATABASE_URL="postgresql://${DATABASE_URL#postgresql+asyncpg://}" ;;
  *) PSQL_DATABASE_URL="$DATABASE_URL" ;;
esac

psql "$PSQL_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DO $$
BEGIN
    IF current_user <> 'app_role' THEN
        RAISE EXCEPTION 'Connect as app_role (connected as %)', current_user;
    END IF;
    IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
        RAISE EXCEPTION 'Connected role must be NOSUPERUSER and NOBYPASSRLS';
    END IF;
END
$$;

INSERT INTO "Empresa" (nombre, slug)
VALUES ('RLS verification fixture', 'rls-verification-' || txid_current())
RETURNING "idEmpresa" AS verify_tenant_id \gset
SELECT set_config('verify.tenant_id', :'verify_tenant_id', true);
SELECT set_config('app.empresa_id', current_setting('verify.tenant_id'), true);
INSERT INTO "Usuario" (nombre, correo, "contraseña", "codigoRol", "idEmpresa")
SELECT 'RLS verification fixture',
       'rls-verification-' || txid_current() || '@invalid.test',
       'not-a-real-password', "codigoRol", current_setting('verify.tenant_id')::integer
FROM rol WHERE "nombreRol" = 'Cliente'
RETURNING "idUser" AS verify_user_id \gset
SELECT set_config('verify.user_id', :'verify_user_id', true);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Usuario"
        WHERE "idUser" = current_setting('verify.user_id')::bigint
    ) THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'Fixture row is not visible to its own tenant';
    END IF;
END
$$;

SELECT set_config('app.empresa_id', '1', true);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Usuario"
        WHERE "idUser" = current_setting('verify.user_id')::bigint
    ) THEN
        RAISE EXCEPTION 'Tenant 1 can see the supplied cross-company Usuario row';
    END IF;
END
$$;

SELECT set_config('app.empresa_id', '', true);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM producto LIMIT 1) THEN
        RAISE EXCEPTION 'Tenantless access returned a business-table row';
    END IF;
END
$$;

ROLLBACK;
\echo RLS smoke check passed: tenant 1 cannot see another tenant fixture and tenantless product query is empty; fixture rows rolled back.
SQL
