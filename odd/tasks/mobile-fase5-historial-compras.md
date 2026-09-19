# Mobile Fase 5 — Historial de Compras

## Objective
Nueva pantalla mostrando las compras reales del Cliente — no existe nada
de esto en mobile hoy (fuera del carrito/checkout de Fase 2, que no
persiste ni muestra historial).

## Contrato de backend (verificado ahora,
`backend/app/routers/purchase_history.py`)
```
GET /api/purchase-history   (auth requerido, auto-scoped al Cliente)
  out: list[PurchaseHistoryItem { idVenta, fecha, total, idProducto,
       producto_nombre?, cantidad, precio_unitario, codigoHistorial? }]
```
**Importante**: cada fila es un ITEM de línea, no una venta completa — una
compra con 3 productos distintos aparece como 3 filas que comparten el
mismo `idVenta`/`fecha`/`total` (el `total` es el total DE LA VENTA
completa, repetido en cada fila, no el subtotal de esa línea — el subtotal
de línea es `cantidad * precio_unitario`). **Agrupar por `idVenta`** antes
de mostrar, para no confundir al usuario mostrando el mismo total 3 veces
seguidas — cada "compra" es una tarjeta con su fecha/total únicos y la
lista de items adentro.

## Tasks
- [x] **T1** — `purchase_history_model.dart` (incluye getter `subtotalLinea`)
      + `purchase_history_service.dart`.
- [x] **T2** — `purchase_history_screen.dart`: agrupa por `idVenta`
      (`Map<int, List<PurchaseHistoryItem>>`, orden preservado — el backend
      ya devuelve `fecha.desc()`), tarjeta por venta con "Total:" (venta
      completa) claramente distinto de "Subtotal:" por línea — verificado
      sin ambigüedad.
- [x] **T3** — Entrada "HISTORIAL DE COMPRAS" en `profile_screen.dart`,
      junto a "MIS RESERVAS" de Fase 3. Re-leído tras editar: las 3
      secciones mock (medidas, estilo IA, looks guardados) intactas.
- [ ] **T4** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, confirmar que las compras
      reales (incluida la del checkout de Fase 2, si se probó) aparecen
      agrupadas correctamente.

## Acceptance criteria
- Historial real visible, agrupado por venta (no una fila plana por línea).
- No se toca ninguna sección mock de `profile_screen.dart`.
- `flutter analyze` sin errores nuevos (verificado por el usuario).

## Progress
- 2026-09-19: Fases 1-4 completadas. Usuario eligió Historial de Compras
  como Fase 5 (última de las disponibles — "Perfil real" queda pendiente,
  "Citas" sigue bloqueada). Contrato verificado contra el código real del
  backend recién ahora (no se había leído antes esta sesión). Task file
  creado.

## Next step
T1-T3 implementación (delegada), T4 a cargo del usuario.
