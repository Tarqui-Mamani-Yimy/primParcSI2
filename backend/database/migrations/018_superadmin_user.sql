-- 018: platform SuperAdmin user (no company, idEmpresa NULL).
-- Password hash is the same bcrypt hash used by the seed users in base.sql.
-- Idempotent: inserts only if the email does not exist yet.
BEGIN;

INSERT INTO "Usuario" (nombre, correo, "contraseña", "codigoRol", "idEmpresa")
SELECT 'Yimy SuperAdmin',
       'yimyt771@gmail.com',
       '$2b$12$HWqim2KP4GxJWv1kOb79tudNBV0Y94xoM2y5JRa32DSGPigvenb1C',
       r."codigoRol",
       NULL
FROM rol r
WHERE r."nombreRol" = 'SuperAdmin'
  AND NOT EXISTS (SELECT 1 FROM "Usuario" WHERE correo = 'yimyt771@gmail.com');

COMMIT;
