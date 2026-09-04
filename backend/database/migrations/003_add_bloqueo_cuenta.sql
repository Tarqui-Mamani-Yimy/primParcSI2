-- 003_add_bloqueo_cuenta.sql
-- Migracion ADITIVA obligatoria para el backend.
-- La tabla "Usuario" de backend/database/base.sql no guarda el estado de los
-- intentos de inicio de sesion. Se agregan cuatro columnas para poder bloquear
-- la cuenta despues de 3 intentos fallidos consecutivos:
--   - intentos_fallidos : contador de intentos fallidos consecutivos (se
--                         reinicia a 0 en cada login correcto)
--   - bloqueado         : TRUE cuando la cuenta quedo bloqueada
--   - fecha_bloqueo     : momento en que se bloqueo la cuenta
--   - ultimo_intento    : momento del ultimo intento fallido
-- Debe aplicarse manualmente sobre el contenedor ropaDocker, despues del base.sql.

ALTER TABLE "Usuario"
    ADD COLUMN IF NOT EXISTS "intentos_fallidos" INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "bloqueado" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "fecha_bloqueo" TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS "ultimo_intento" TIMESTAMPTZ NULL;
