# Mobile Fase 4 — Recomendaciones + Chatbot (CU22/CU23)

## Objective
Consumir desde mobile los dos endpoints de IA (Gemini) que ya están
construidos y probados en vivo esta sesión — sin cambios de backend, la
fase más rápida de las cuatro.

## Contrato de backend (ya construido y probado en vivo esta sesión,
`backend/app/routers/recommendations.py` y `backend/app/routers/chat.py`)
```
GET /api/recommendations   (auth requerido, auto-scoped al Cliente)
  out: list[RecomendacionOut { idRecomendacion, nombre, importancia:
       "Alta"|"Media"|"Baja", idCliente, idProducto?: int, producto_nombre?: str }]
  (idProducto/producto_nombre son null solo en filas viejas creadas
  manualmente por staff antes de CU22 — las generadas por IA siempre los
  tienen)

POST /api/chat   (auth requerido)
  in:  ChatIn { mensaje: str, historial: list[ChatMensaje{role: "user"|"model", texto: str}] }
  out: ChatOut { respuesta: str, historial: list[ChatMensaje] }
  (el backend devuelve el historial COMPLETO actualizado — el cliente
  nunca arma el historial a mano, siempre reemplaza con lo que el backend
  devolvió, mismo criterio que la web en
  `web/src/app/shared/components/chat-widget.component.ts`, ya construido
  y probado esta sesión — copiar ese diseño exacto: separar lo que se
  MUESTRA — puede incluir un saludo local que nunca se manda al backend —
  de lo que se ENVÍA como `historial`)
```

## Diseño

### Recomendaciones
- `home_screen.dart` ya tiene una franja "Piezas Destacadas" con productos
  reales (Fase 1). Agregar una franja similar "Recomendado para vos" ARRIBA
  de esa (o donde quede mejor visualmente — criterio del implementador),
  solo si `getMisRecomendaciones()` devuelve algo (ocultar por completo si
  está vacío — cliente nuevo sin historial de compras, o
  `productos_bajo_stock`/generación aún no corrida).

### Chatbot
- `main_navigation_shell.dart` es un `Scaffold` único que envuelve las 5
  tabs vía `IndexedStack` — tiene un slot `floatingActionButton` libre, el
  lugar natural para un botón persistente visible en TODAS las tabs
  (equivalente mobile del widget flotante fijo que ya existe en la web).
- Al tocar el FAB: abrir un modal/pantalla de chat simple — lista de
  mensajes (usuario alineado a la derecha, asistente a la izquierda),
  input + botón enviar, indicador de "escribiendo…" mientras espera
  respuesta, estado de error inline si falla (no solo un SnackBar — mismo
  criterio que la web).

## Tasks
- [x] **T1** — `recomendacion_model.dart` + `recommendations_service.dart`.
- [x] **T2** — `chat_message_model.dart` (`ChatMensaje` + `ChatRespuesta`
      tipada) + `chat_service.dart`.
- [x] **T3** — Franja "Recomendado para vos" en `home_screen.dart` (oculta
      si vacía, badge por importancia). `HomeScreen` pasó a `StatefulWidget`
      (estado local, nada más lo necesita).
- [x] **T4** — `chat_widget.dart` (bottom sheet, mismo patrón que
      `CartModal`). Spot-check del orquestador: `_mensajes` (display, con
      saludo local) separado de `_historial` (siempre reemplazado entero
      por lo que devuelve el backend) — fiel al diseño de la web. FAB
      persistente en `main_navigation_shell.dart`, visible en las 5 tabs.
- [ ] **T5** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, probar el chat en vivo (pregunta
      de catálogo + pregunta sobre compras propias), confirmar que las
      recomendaciones mostradas coinciden con las de la BD real.

## Acceptance criteria
- Recomendaciones reales visibles en Home (o correctamente ocultas si no
  hay ninguna).
- Chat funcional desde cualquier tab, respuestas reales de Gemini, nunca
  arma el historial a mano del lado del cliente.
- `flutter analyze` sin errores nuevos (verificado por el usuario).

## Progress
- 2026-09-19: Fases 1-3 completadas. Usuario eligió Recomendaciones+Chat
  como Fase 4 (la más rápida de las tres restantes — historial de compras
  y perfil real quedan pendientes). Contrato ya verificado contra el código
  real del backend, sin cambios necesarios ahí. Task file creado.

## Next step
T1-T4 implementación (delegada), T5 a cargo del usuario.
