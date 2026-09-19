# CU07 (parcial) — Ingreso de Lote

## Objective
CU07 se llama "Gestionar Proveedores e Ingreso de Lotes" pero solo la parte
de proveedores (CRUD) estaba implementada. Falta el "Ingreso de Lote": la
única forma de darle stock inicial a un producto nuevo en una sucursal.

## Problem / Why
Investigando por qué un usuario no podía "meter prendas al catálogo" /
probar la pasarela de pagos (síntoma: "producto no disponible"), se confirmó
que:
- `POST /api/products` (crear producto) funciona bien.
- Pero NINGÚN endpoint crea una fila de `Inventario` para un producto nuevo:
  `PATCH /api/inventory/stock/{idInv}/adjust` requiere un `idInv` YA
  existente (404 si no existe); `POST /api/dispatches` (traspaso) requiere
  que la sucursal ORIGEN ya tenga stock para transferir.
- Resultado: un producto recién creado nunca puede tener stock por ningún
  camino de la API — por eso siempre sale "no disponible" al comprarlo.
- Confirmado en la BD viva: solo existen los 3 productos del seed original,
  todos con stock asignado a mano; nada creado después tiene stock.
- Usuario confirmó (AskUserQuestion) que quiere que se implemente el
  Ingreso de Lote, no solo un flujo de prueba alternativo.

## Scope
- Backend: nuevo endpoint que crea/incrementa la fila de `Inventario` para
  (idProducto, codigoSucursal), registra un `Movimiento` tipo `entrada_lote`,
  opcionalmente referencia un `idProveedor`.
- Frontend: nuevo modal en la página Inventario (mismo patrón que el modal
  de Transferencia ya existente), botón "Ingreso de Lote".
- Permiso: reutiliza `inventario.ajustar` (ya lo tienen Administrador y
  Encargado de Sucursal) — sin migración nueva.
- Fuera de alcance: no se crea una tabla `Lote` dedicada (no existe en el
  esquema de 20 tablas y no hace falta — el `Movimiento` con
  motivo/referencia ya registra la trazabilidad, mismo patrón que
  `dispatches.py`).

## Tasks
- [x] **T1** — `StockIngresoIn` en `backend/app/schemas/inventory.py`.
- [x] **T2** — `POST /api/inventory/stock/ingreso` en `backend/app/routers/inventory.py`.
      Verificado: registrado en `/openapi.json` del backend corriendo,
      rechaza sin auth (401), `python -c "import app.main"` OK. También
      factorizó `_serialize_stock()` (dedup con `adjust_stock`).
- [x] **T3** — Frontend: `receiveStock()` en `inventory.service.ts`, botón +
      modal "Ingreso de Lote" en `inventory.component.ts`, tipo
      `StockIngresoIn` en `core/models/index.ts`. `tsc --noEmit` sin errores
      nuevos.
- [ ] **T4** — Verificación manual end-to-end. **Backend (localhost:8000) y
      web (localhost:3000) ya están corriendo** contra el `ropaDocker` real.
      No tengo credenciales de Administrador para probar por API directa —
      queda para que el usuario lo pruebe en el navegador con el flujo
      documentado en la respuesta de esta sesión.

## Acceptance criteria
- Un producto nuevo puede recibir stock inicial en cualquier sucursal desde
  la UI, sin pasar por una transferencia ni un ajuste sobre un `idInv`
  inexistente.
- `npx tsc --noEmit` sin errores nuevos.
- El flujo completo (crear producto → ingreso de lote → aparece en catálogo
  con stock → comprable vía Stripe test) se verifica en vivo esta sesión
  (`ropaDocker` y backend ya están arriba).

## Progress
- 2026-09-19: Causa raíz diagnosticada y confirmada en código + BD viva.
  Usuario eligió implementar el fix completo. Task file creado.

## Next step
T1-T3 implementación (un solo writer, backend+frontend juntos — alcance
chico, ~4 archivos).
