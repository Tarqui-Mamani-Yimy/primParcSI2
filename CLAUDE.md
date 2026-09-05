# primParcSI2 — Sistema de venta de ropa Unisex

Proyecto del primer parcial de SI2: backend único (Python/FastAPI) que sirve
tanto a la web (Angular) como a la app móvil (Flutter).

## Estructura

```
backend/   FastAPI + SQLAlchemy async + Postgres (contenedor Docker "ropaDocker")
web/       Angular 22 (standalone components, signals) + Vite. Usa pnpm.
mobile/app/ Flutter (actualmente sin conectar al backend real, usa datos mock)
```

## Comandos

- Backend: `cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`
- Web: `cd web && pnpm run dev` (puerto 3000). **Usar pnpm, no npm.**
- Base de datos: contenedor Docker `ropaDocker` (Postgres 17). Si `docker ps` no lo muestra, el daemon de Docker está caído y hay que pedirle al usuario que lo levante (`sudo systemctl start docker`) — el agente no tiene privilegios sudo en esta máquina.
- Verificar tipos web: `cd web && npx tsc --noEmit` (el único error esperado y preexistente es `./index.css` en `main.ts`, no es un bug).

## Base de datos

- `backend/database/base.sql` es el esquema base (20 tablas, nombres en español, ej. `Usuario`, `Producto`, `Inventario`, `Movimiento`, `Venta`, `Cliente`, `Sucursal`, `Ciudad`, `Rol`, `Permiso`). **Nunca se edita directamente.**
- El usuario mantiene su propio seed de datos dentro de `base.sql` (incluye hashes bcrypt reales). No sobrescribir esa sección sin confirmar con el usuario.
- Cualquier cambio de esquema posterior va como migración aditiva en `backend/database/migrations/00X_*.sql` (siempre `ADD COLUMN IF NOT EXISTS`, nunca destructivo) y se aplica a mano contra el contenedor vivo:
  `docker exec -i ropaDocker psql -U yimysito -d ropaDB -v ON_ERROR_STOP=1 -f /dev/stdin < backend/database/migrations/00X_*.sql`
  (ojo: sin `-i` el comando "funciona" sin error pero no aplica nada — verificar siempre con `\d "Tabla"` después).
  Ver `backend/database/migrations/README.md`.

## Autenticación y seguridad

- JWT sin cookies (el mismo backend sirve web y mobile). El payload lleva `sub`, `correo`, `rol`, `permisos` (los permisos van embebidos en el token, no se resuelven en cada request).
- RBAC vía tablas `rol` / `permiso` / `asignacion_permiso`. Dependencia `require_permiso("nombre.permiso")` en `app/security.py`.
- Reglas de contraseña (compartidas por registro, cambio y recuperación): mínimo 10 caracteres, 1 minúscula, 1 mayúscula, 1 número, 1 carácter especial. Validador: `validate_password_strength` en `app/security.py`.
- Bloqueo de cuenta progresivo tras 3 intentos fallidos de login: 1er bloqueo 30s, 2do 1min, 3ro 5min, 4to 15min; a partir del 5to bloqueo la cuenta queda inactiva (`requiereActivacion=true`) hasta que un administrador la reactive con `PATCH /api/team/{idUser}/activate` (permiso `usuario.admin`). Columnas `intentosFallidos`/`bloqueadoHasta` (migración `003_add_bloqueo_login.sql`) y `vecesBloqueado`/`requiereActivacion` (migración `004_add_bloqueo_progresivo.sql`) en `Usuario`.
- Recuperación de contraseña: `POST /api/auth/forgot-password` intenta enviar un correo real por SMTP (`app/email_utils.py`, credenciales en `.env`: `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`). Si no hay SMTP configurado, cae automáticamente a modo desarrollo devolviendo `reset_token_dev` en la respuesta. El enlace apunta a `{FRONTEND_URL}/?reset_token=...`; la web lo detecta en `login.component.ts` (`ngOnInit` lee `window.location.search`) y abre el paso 2 directamente.

## Convenciones importantes

- **Idioma**: toda la UI (web y mobile) está en español, con tildes y eñes correctas. El código (variables, clases, archivos) se mantiene en inglés/mixto como ya estaba. El nombre de marca ficticio es "YouShop" (antes "AETHER"; el código mobile conserva identificadores internos como `AetherTheme`/`aether_fashion` por ser nombres de paquete/clase, no texto visible).
- **Angular + regex**: las expresiones de template de Angular **no soportan literales de expresión regular** (`/[a-z]/.test(x)` en un binding rompe la compilación AOT y cae a JIT, que falla en runtime con pantalla en blanco). Cualquier validación con regex debe ir en un método de la clase del componente, nunca inline en el template.
- **Vite cache**: si después de cambios grandes el navegador muestra errores raros de compilación de un componente puntual, probar borrando `web/node_modules/.vite` antes de asumir que es un bug de código.
- No se usa Angular Router; la navegación entre vistas es manual vía signals (`AppView` en `sidebar.component.ts`, actualmente: `dashboard | archive | inventory | logistics | team`).

## Estado conocido (para no repetir trabajo)

Backend con API funcional para: auth (CU01/02), catálogo de productos (CU05), temporadas/colecciones (CU06), proveedores (CU07), ciudades/sucursales (CU04), inventario y movimientos (CU08/09), ventas, reservas, despachos/traspasos, historial, recomendaciones, logs.

Pendiente / gaps conocidos:
- **CRÍTICO — permisos del seed real no coinciden con los que verifica el código.** El seed propio del usuario en `base.sql` usa roles (`Administrador`, `Encargado de Sucursal`, `Cajero`, `Proveedor`, `Cliente`) y permisos (`GESTION_GLOBAL_SISTEMA`, `ACCESO_CLIENTE_OMNICANAL`, ...) con nombres distintos a los que TODOS los routers verifican vía `require_permiso("...")` (`usuario.admin`, `equipo.ver`, `producto.crear`, etc., definidos en `app/seed.py`, que ya no es la fuente de verdad). Resultado: el `Administrador` real (`codigoRol=1`) solo tiene `GESTION_GLOBAL_SISTEMA` asignado y **no pasa ningún `require_permiso` del código actual** — prácticamente todos los endpoints protegidos le devolverían 403. `team.py` -> `list_team` además filtra roles por nombre literal `["Admin", "Vendedor"]`, que tampoco existen con esos nombres en el seed real, por lo que `GET /api/team` devuelve vacío. **Pendiente de decisión del usuario**: mapear los permisos reales en `asignacion_permiso` a los nombres que usa el código, o cambiar el código para usar los nombres de permiso del seed real. No tocar `base.sql` sin confirmar primero.
- `POST /api/auth/register` ya crea también el registro en `Cliente` (corregido).
- `team.py` (CU03, Gestionar Usuarios y Roles) tiene lectura (listar equipo, ver bitácora) y ahora reactivación de cuentas bloqueadas (`PATCH /{idUser}/activate`); sigue faltando crear un usuario staff nuevo o cambiarle el rol.
- La web (`web/src/app`) solo tiene pantallas para Dashboard, Archivo, Inventario, Logística y Equipo. No hay UI para Ciudades/Sucursales, Temporadas/Colecciones ni Proveedores, aunque el backend ya los soporta.
- `mobile/app` está traducida al español pero sigue usando datos mock locales (`app_state.dart`), sin conectar al backend real — fuera de alcance salvo que se pida explícitamente.

## Orquestación con agentes (Herdr + OpenCode)

Este proyecto se trabaja con dos agentes en paneles separados de Herdr:
backend (`Big Pickle`, pane etiquetado `backend-bigpickle`) y frontend web
(`Mimo V2.5 Free`, pane etiquetado `frontend-mimo`). Si un pane se desconecta
de su sesión real tras un reinicio del entorno (verificar con
`herdr pane process-info --pane <ID>` y leyendo el pane con
`herdr pane read`; si el modelo mostrado en pantalla no coincide con el
esperado, está mal conectado), reconectarlo con
`herdr agent start <nombre> --kind opencode --pane <ID> -- -s <sessionID> -m <modelo>`
en vez de asumir que un prompt nuevo lo va a arreglar solo.

El entorno ha sufrido reinicios/rollbacks inesperados que borran cambios en
disco hechos después de cierto punto (aunque el historial de chat del agente
sobrevive).

**IMPORTANTE — prohibido hacer commits**: ni Claude ni los agentes (Big Pickle,
Mimo) deben ejecutar `git commit` bajo ninguna circunstancia, sin importar el
riesgo de rollback del entorno. Los commits los hace únicamente el usuario. Si
un agente termina una tarea, debe dejar los cambios en el working tree y
avisar, nunca commitear por su cuenta.
