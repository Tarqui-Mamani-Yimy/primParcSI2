# Mobile Fase 2 — Checkout real (Stripe)

## Objective
Reemplazar el "FINALIZAR COMPRA" falso de `cart_modal.dart` (hoy solo
muestra un `SnackBar` y no persiste nada) por un checkout real: Stripe
mobile SDK + el mismo flujo de 3 pasos que ya usa la web
(`crear intent → confirmar con Stripe → verificar → crear venta`).

## Scope
Solo Android (confirmado por el usuario para toda la integración mobile).
Sin cambios de backend — los endpoints de pago/venta ya existen y están
probados en producción vía la web esta misma sesión.

## Contrato de backend (ya verificado, `backend/app/schemas/fase2.py`)
```
POST /api/payments/intents
  in:  PagoIntentIn { items: [{idProducto, cantidad}], claveIntento: UUID,
                      concepto?: str, proposito: "venta"|"reserva_deposito" = "venta",
                      codigoSucursal?: int }
  out: PagoIntentOut { paymentIntentId, clientSecret, monto }

POST /api/payments/intents/{id}/verify
  out: PagoIntentVerificadoOut { paymentIntentId, estado, pagado: bool,
                                  idMetPago?: int, monto?: float }

POST /api/sales
  in:  VentaIn { idCliente?: int (derivado del JWT para un Cliente — NO
                 enviarlo desde mobile), idMetPago: int,
                 codigoSucursal?: int (None => el backend resuelve),
                 items: [{idProducto, cantidad}] }
  out: VentaOut { idVenta, fecha, total, idCliente, idMetPago, detalles: [...] }
```
Compra online (no POS): nunca se manda `codigoSucursal` — el backend
resuelve automáticamente una sucursal con stock suficiente (mismo criterio
que la web, "D4").

## Máquina de estados a replicar (ya probada y correcta en
`web/src/app/features/customer/checkout/purchase-modal.component.ts`,
leído esta sesión — copiar el DISEÑO, no el código Angular)
`iniciando → cobrando → cobrado_sin_venta | comprado | error`
- El pago SIEMPRE se obtiene antes de `POST /api/sales`.
- Si la venta falla DESPUÉS de un cobro ya verificado (`pagado: true`), el
  `idMetPago` se retiene para reintentar `POST /api/sales` — **nunca se
  vuelve a cobrar**. Este es el caso "cobrado_sin_venta": mostrar un
  mensaje claro + botón "Reintentar" que solo reintenta `crearVenta`, no
  `crearIntent`.
- Si el usuario cancela el `PaymentSheet` de Stripe o la tarjeta es
  rechazada, no se llega a cobrar nada — el carrito queda intacto, se
  puede reintentar desde cero (nuevo intent, nuevo `claveIntento`).

## Gap de infraestructura encontrado (Fase 1 no lo necesitaba, esta sí)
`AndroidManifest.xml` no declara `android.permission.INTERNET` — ninguna
llamada de red va a funcionar de forma confiable en un build que no sea
debug sin esto. Se agrega en esta fase.

## Tasks
- [x] **T1** — `flutter_stripe: ^11.1.0` + `uuid: ^4.4.0` (necesaria para
      `claveIntento`, ver Progress) agregadas. Permiso `INTERNET` agregado
      a `AndroidManifest.xml`.
- [x] **T2** — `stripePublishableKey` en `api_config.dart`, inicialización
      en `main.dart` antes de `runApp`.
- [x] **T3** — `payments_service.dart` (`crearIntent`/`verificarIntent`).
- [x] **T4** — `sales_service.dart` (`crearVenta`).
- [x] **T5** — `cart_modal.dart` convertida a `StatefulWidget`, máquina de
      estados completa (`idle/cobrando/cobradoSinVenta/error`). Spot-check
      del orquestador: fiel al diseño de `purchase-modal.component.ts` —
      pago siempre antes de la Venta, reintento post-cobro nunca vuelve a
      cobrar, botón deshabilitado durante `cobrando`, confirmación con
      datos reales de la Venta.
- [ ] **T6** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, probar en dispositivo/emulador
      Android con tarjeta de test de Stripe (`4242 4242 4242 4242`),
      confirmar que la Venta aparece en la base de datos real y que el
      stock baja.

## Acceptance criteria
- Compra real de punta a punta: cobro con Stripe → Venta creada en la BD
  real → stock decrementado (mismo comportamiento que ya funciona en la
  web).
- Tarjeta rechazada o cancelación: carrito intacto, mensaje real, se puede
  reintentar.
- Fallo de venta post-cobro: nunca cobra dos veces, retiene `idMetPago`,
  botón de reintento explícito.

## Progress
- 2026-09-19: Fase 1 (infra+auth+catálogo) completada. Usuario confirmó
  Fase 2 = Checkout. Contrato de pagos/ventas ya verificado contra el
  código real del backend (mismo que usa la web, sin cambios necesarios
  ahí). Gap de permiso INTERNET detectado. Task file creado.

## Next step
T1-T5 implementación (delegada), T6 a cargo del usuario.
