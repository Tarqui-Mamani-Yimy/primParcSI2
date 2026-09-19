# Mobile Fase 3 — Reservas (CU12)

## Objective
Reservar una prenda para retirar en sucursal, con depósito del 10% vía
Stripe — mismo mecanismo de pago que Fase 2 (checkout), reutilizando
`PaymentsService`. No existe ninguna pantalla de reservas en mobile hoy
(`appointments_screen.dart` es un concepto MOCK distinto y no relacionado
— "citas" de estilo, sin backend — no confundir ni reutilizar esa
pantalla para esto).

## Scope
Solo Android. Sin cambios de backend — `reservations.py` ya existe y está
probado vía web esta sesión.

## Contrato de backend (`backend/app/schemas/fase2.py`, ya leído esta sesión)
```
POST /api/payments/intents  (mismo endpoint de Fase 2, distinto proposito)
  in: PagoIntentIn { items: [{idProducto, cantidad: 1}], claveIntento: UUID,
                     concepto?, proposito: "reserva_deposito",
                     codigoSucursal: int }   <- OBLIGATORIO para reserva,
                                                a diferencia de la compra
  out: PagoIntentOut { paymentIntentId, clientSecret, monto }
       (monto = 10% del precio, calculado server-side con piso minimo)

POST /api/payments/intents/{id}/verify   (identico a Fase 2)

POST /api/reservations
  in:  ReservaIn { fecha: date (YYYY-MM-DD), horario: str (HH:MM),
                   idCliente?: int (derivado del JWT, NO enviarlo),
                   codigoSucursal: int, idProducto: int, idMetPago: int }
  out: ReservaOut { codigoReserva, fecha, horario, estado, idCliente,
                     codigoSucursal, idProducto, producto_nombre?,
                     sucursal_nombre?, idMetPago?, montoDeposito? }

GET /api/reservations   (auto-scoped al Cliente autenticado)
  out: list[ReservaOut]

GET /api/inventory/locations   (publico, sin auth)
  out: list[LocationOut { codigoSucursal, nombre, direccion, ciudad }]
```
**Diferencia clave con Fase 2**: `codigoSucursal` es OBLIGATORIO al crear
el intent (el backend valida stock EN esa sucursal específica y aplica un
piso mínimo de depósito ANTES de llamar a Stripe — nunca se cobra si el
piso no se cubre). En la compra online, `codigoSucursal` nunca se manda.

## Validaciones a replicar (mismo criterio que
`web/src/app/features/customer/reservations/reservation-form.component.ts`,
ya leído esta sesión — copiar el DISEÑO)
- `horario` debe matchear `HH:MM` (compatible con `time.fromisoformat` del
  backend) — validar con una función de la clase, NUNCA un literal regex
  inline si se usa algún framework de widgets declarativo con binding (en
  Flutter no aplica la restricción de Angular AOT, pero mantené la validación
  en un método, no repetida en tres lugares).
- `fecha` no puede ser anterior a HOY, calculado con los componentes de
  fecha LOCALES del dispositivo (no UTC — mismo motivo que la web: comparar
  contra UTC rechaza "hoy" para cualquier usuario en huso horario detrás de
  UTC durante la noche).
- Misma máquina de estados que Fase 2 (`iniciando → cobrando →
  cobrado_sin_reserva → error`): el pago del depósito SIEMPRE se obtiene
  antes de `POST /api/reservations`; si la reserva falla después de un
  cobro verificado, se retiene `idMetPago` para reintentar sin recobrar.

## Tasks
- [x] **T1** — `sucursal_model.dart`, `locations_service.dart`.
- [x] **T2** — `reservations_service.dart`.
- [x] **T3** — `reservation_form_screen.dart` — máquina de estados
      completa, misma retención de `idMetPago` que Fase 2 en caso de fallo
      post-cobro (`cobradoSinReserva`).
- [x] **T4** — Botón "RESERVAR EN SUCURSAL" agregado en `try_on_screen.dart`.
- [x] **T5** — `my_reservations_screen.dart` + entrada "MIS RESERVAS" en
      `profile_screen.dart` (justo después del header de usuario, antes de
      las secciones mock existentes — verificado por el orquestador que
      esas secciones quedaron intactas).
      **Detalle de compatibilidad**: `payments_service.dart::crearIntent`
      ganó parámetros opcionales (`proposito`, `codigoSucursal`) con
      defaults que preservan el comportamiento exacto de Fase 2 sin tocar
      su call site.
- [ ] **T6** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, reservar con tarjeta de test,
      confirmar que la Reserva aparece en la BD real con el depósito
      correcto (10% con piso mínimo aplicado).

## Acceptance criteria
- Reserva real de punta a punta: depósito cobrado vía Stripe → Reserva
  creada en la BD real, ligada a la sucursal elegida.
- Validaciones de fecha/horario correctas (fecha local, no UTC).
- Mismo criterio anti-doble-cobro que Fase 2 en el caso `cobrado_sin_reserva`.
- Cliente puede ver sus reservas reales (no mock).

## Progress
- 2026-09-19: Fase 2 (checkout) completada. Usuario eligió Reservas como
  Fase 3 (de 4 opciones ofrecidas: reservas/perfil/historial/recomendaciones
  +chat). Contrato ya verificado contra el código real del backend y contra
  el diseño ya probado de `reservation-form.component.ts` (web). Task file
  creado.

## Next step
T1-T5 implementación (delegada), T6 a cargo del usuario.
