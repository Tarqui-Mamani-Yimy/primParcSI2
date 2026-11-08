# Migraciones del backend

Las migraciones ubicadas en este directorio son **ADITIVAS** y **MANUALES**.
No se edita `database/base.sql`; el esquema base se crea solo con ese archivo
y luego se aplican estas migraciones encima.

## Aplicar manualmente sobre el contenedor `ropaDocker`

El contenedor Postgres ya corre (ver `compose.yml`):
- DB: `ropaDB`
- User: `yimysito`
- Password: `tarqui231`
- Puerto: `5432` en localhost

Secuencia recomendada (en el host, una sola vez):

```bash
# 1) Asegurarse de que Postgres este corriendo
docker start ropaDocker

# 2) Aplicar la migracion 001 (columna "referencia" en Movimiento)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/001_add_referencia_movimiento.sql

# 3) Aplicar la migracion 002 (imagenes de producto)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/002_add_imagenes_producto.sql

# 4) Aplicar la migracion 003 (bloqueo de cuenta tras intentos fallidos)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/003_add_bloqueo_login.sql

# 5) Aplicar la migracion 004 (bloqueo progresivo + activacion manual)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/004_add_bloqueo_progresivo.sql

# 6) Aplicar la migracion 005 (asignar permisos granulares a los roles reales)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/005_asignar_permisos_reales.sql

# 7) Aplicar la migracion 006 (columnas Stripe en metodo_pago)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/006_add_stripe_metodo_pago.sql

# 8) Aplicar la migracion 007 (permiso venta.crear para el rol Cliente, CU17/CU18)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/007_permiso_venta_cliente.sql

# 9) Aplicar la migracion 008 (columna idUserPago en metodo_pago, CU17/CU18)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/008_add_metodo_pago_owner.sql
```

Usar `ADD COLUMN IF NOT EXISTS` para que sean idempotentes (se pueden
re-ejecutar sin error). La migracion 005 usa `INSERT ... SELECT ... WHERE NOT EXISTS`
para ser igual de idempotente.

## Verificacion rapida

```bash
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "Movimiento"'
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "producto"'

# Permisos por rol (migracion 005):
docker exec ropaDocker psql -U yimysito -d ropaDB -c \
  'SELECT r."codigoRol", r."nombreRol", COUNT(ap."idRolPermiso") AS total_permisos
   FROM "rol" r LEFT JOIN "asignacion_permiso" ap ON ap."codigoRol" = r."codigoRol"
   GROUP BY r."codigoRol", r."nombreRol" ORDER BY r."codigoRol";'

# El rol Cliente (5) debe tener venta.crear (migracion 007):
docker exec ropaDocker psql -U yimysito -d ropaDB -c \
  'SELECT r."nombreRol", p."nombrePermiso"
   FROM "asignacion_permiso" a
   JOIN "rol" r ON r."codigoRol" = a."codigoRol"
   JOIN "permiso" p ON p."idPermiso" = a."idPermiso"
   WHERE r."codigoRol" = 5 AND p."nombrePermiso" = 'venta.crear';'

# Columna idUserPago en metodo_pago (migracion 008):
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "metodo_pago"'
```

## Backups por empresa

El workflow `.github/workflows/tenant-backups.yml` crea backups diarios y también
se puede iniciar manualmente desde **Actions → Tenant database backups → Run
workflow**. Exporta todas las empresas, sin filtrar por estado de suscripción,
y el catálogo global en un archivo separado. Si falla una empresa, procesa las
demás y el job termina con error enumerando los IDs fallidos.

Crear en Supabase Storage un bucket privado dedicado (por defecto `backups`);
no reutilizar `SUPABASE_STORAGE_BUCKET`, que es el bucket público de imágenes.
Configurar como GitHub Actions secrets `DATABASE_URL` (PostgreSQL con driver
`postgresql+asyncpg`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SECRET_KEY` (requerido por la configuración del backend al iniciar; el script no firma tokens). El secret
`SUPABASE_BACKUP_BUCKET` permite cambiar el bucket. La variable opcional
`BACKUP_RETENTION_DAYS` controla la retención de backups automáticos (30 días
por defecto); los manuales nunca se eliminan automáticamente.

Para ejecutar localmente, definir esas variables en `backend/.env` y correr
desde `backend/`:

```bash
.venv/bin/python -m scripts.backup_tenants
```

Un SuperAdmin con `plataforma.admin` puede crear el backup manual con
`POST /api/platform/empresas/{idEmpresa}/backups`, consultar la lista mediante
`GET /api/platform/empresas/{idEmpresa}/backups` y solicitar una URL firmada
de descarga con `GET /api/platform/empresas/{idEmpresa}/backups/{nombre}/download`
(vigencia de 300 segundos). No se ofrece restauración.

El exportador descubre dinámicamente las tablas públicas: filtra las que tienen
`idEmpresa` al tenant correspondiente e incluye las tablas globales sin esa
columna en `_global`. Fechas, decimales y UUID se serializan como texto; los
bytes se codifican con prefijo `base64:` y las columnas vectoriales se exportan
como texto e identifican en `metadata.vectorColumns`.
