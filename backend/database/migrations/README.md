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

# 4) Aplicar la migracion 003 (bloqueo de cuenta por intentos fallidos)
docker exec -i ropaDocker \
  psql -U yimysito -d ropaDB \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin \
  < database/migrations/003_add_bloqueo_cuenta.sql
```

Usar `ADD COLUMN IF NOT EXISTS` para que sean idempotentes (se pueden
re-ejecutar sin error).

## Verificacion rapida

```bash
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "Movimiento"'
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "producto"'
docker exec ropaDocker psql -U yimysito -d ropaDB -c '\d "Usuario"'
```
