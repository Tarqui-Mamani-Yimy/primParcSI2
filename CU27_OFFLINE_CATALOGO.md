# CU27 — Catálogo y existencias offline

Este documento resume el diagnóstico y el cambio realizado en Codex para el CU27. La vista web ahora puede mostrar productos y existencias desde Dexie sin conexión; la comprobación manual con Wi-Fi desconectado todavía está pendiente.

## Alcance

- Caso trabajado: **CU27 — Consultar Catálogo y Existencias Offline**.
- Se respetó el trabajo caso por caso. **CU28, CU29 y CU30 no se implementaron.**
- Se revisaron el router de sincronización y catálogo del backend, el servicio web de sincronización, el esquema SQL, la vista del catálogo y el servicio Dexie.
- El cambio de código quedó limitado a un archivo de la vista web.

## Diagnóstico previo

| Área | Estado encontrado |
|---|---|
| Backend | `GET /api/sync/pull` devuelve productos y, según rol o permiso, sucursales e inventario. |
| Sincronización web | `SyncService` ya persiste productos e inventario en Dexie durante sincronizaciones completas e incrementales. |
| Base local | Dexie ya define las tablas `productos` e `inventario`; no fue necesario cambiar su esquema. |
| PostgreSQL | `producto` contiene talla/color; `Inventario` guarda cantidades por sucursal y producto. El SQL base inspeccionado no define una tabla independiente de variantes. |
| Vista del catálogo | Antes consumía el listado del servicio remoto; no leía productos ni existencias desde Dexie. |

El esquema SQL base no muestra `fechaActualizacion` para producto ni inventario. El comportamiento incremental depende también de los modelos ORM y migraciones, que no se modificaron en este trabajo.

## Implementación realizada

Archivo modificado: `web/src/app/features/customer/catalog/catalog.component.ts`.

- La vista carga productos e inventario desde las tablas locales de Dexie y aplica búsqueda, filtros y paginación en el navegador.
- Al abrir el catálogo con conexión, solicita una sincronización mediante `SyncService`; al completarse, vuelve a leer la caché local.
- Si la consulta de Dexie falla, captura el error y deja la lista vacía en lugar de propagarlo desde la vista.
- Calcula existencias disponibles por producto como `max(0, cantidad_actual - cantidad_reservada)` y suma el resultado entre sucursales.
- Añade un indicador accesible que muestra **“Caché local (Offline)”**, **“Caché local · actualizando”** o **“Datos sincronizados”**, según el estado.
- Se desuscribe de `syncCompleted` al destruir el componente.

## Archivos no modificados

- `web/src/app/core/services/offline-db.service.ts`: solo se inspeccionó; sus tablas existentes se reutilizaron.
- `web/src/app/core/services/sync.service.ts`: solo se inspeccionó y se consumió; sus cambios preexistentes se preservaron.
- No se modificaron backend, mobile ni el esquema de PostgreSQL.

## Verificación

- `git diff --check` para la vista modificada: **correcto**.
- Build y pruebas automatizadas: **no ejecutados**.
- Prueba manual desconectando Wi-Fi: **pendiente**.

### Pasos para probar

1. Abrir el catálogo con conexión y esperar a que termine la sincronización para poblar Dexie.
2. Desconectar Wi-Fi y recargar el catálogo.
3. Confirmar que aparecen productos y existencias, y que funcionan búsqueda, filtros y paginación.
4. Confirmar que el indicador muestra **“Caché local (Offline)”**.
5. Reconectar y confirmar que, después de sincronizar, el indicador cambia a **“Datos sincronizados”**.

La primera carga offline no puede mostrar productos si el dispositivo todavía no tiene una caché poblada.

## Cambios preexistentes preservados

Antes de este cambio, el árbol de trabajo ya tenía modificaciones en `backend/compose.yml`, `mobile/app/lib/screens/`, archivos Flutter generados y pruebas, además de configuración/paquetes de `web` y `web/src/app/core/services/sync.service.ts`. También había un `web/package-lock.json` sin seguimiento. No se incorporaron ni sobrescribieron como parte del CU27.

## Próximo paso

Ejecutar la prueba manual anterior y, si corresponde, corregir los hallazgos del CU27 antes de iniciar CU28.
