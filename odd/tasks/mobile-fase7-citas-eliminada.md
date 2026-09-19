# Mobile — "Citas" resuelta: eliminada (huérfana, no un gap real)

## Decisión (usuario confirmó vía AskUserQuestion)
"Citas" mezclaba dos conceptos distintos:
1. **"Reserva de Probador y Prendas"** — texto idéntico en función a CU12
   (reservar prenda con depósito, retirar en sucursal), ya implementado de
   verdad en Fase 3 (`try_on_screen.dart` → "RESERVAR EN SUCURSAL" →
   `reservation_form_screen.dart`). Estaba duplicado, no le faltaba
   backend.
2. **"Personal Shopping en Tienda"** (agendar 60 min con un estilista) —
   no aparece en ninguno de los 25 casos de uso documentados en
   `documentacion.md`. No era una integración pendiente: el caso de uso en
   sí nunca existió en la especificación del proyecto.

Con eso confirmado, "construir el backend" habría significado inventar un
CU nuevo fuera del alcance del parcial. El usuario eligió eliminar la
pantalla en vez de eso — es la resolución honesta: no queda nada a medio
resolver porque no queda nada inventado sin base.

## Cambios (hechos directo, sin delegar — mecánico, 2 archivos)
- `mobile/app/lib/screens/appointments_screen.dart` — **eliminado**.
- `mobile/app/lib/screens/main_navigation_shell.dart`:
  - Import de `appointments_screen.dart` removido.
  - `AppointmentsScreen()` sacado de `_screens` (ahora 4 tabs: Inicio,
    Colección, Try-On, Perfil).
  - `BottomNavigationBarItem` de "Citas" removido.
  - Comentario explicando la decisión, para que quede documentado el
    porqué si alguien lo busca después.
- Verificado: sin referencias colgando a `appointments_screen`/
  `AppointmentsScreen` en ningún otro archivo. `appState.currentTabIndex`
  no tiene bounds hardcodeados, funciona igual con 4 tabs.

## Estado final de las 25 CU del proyecto (mobile)
Con esto, todo lo que tenía backend real y estaba pendiente de conectar en
mobile quedó resuelto (Fases 1-6 + CU11), y lo único que no se conectó
("Citas") se confirmó que nunca fue un caso de uso real — no queda ningún
gap fantasma ni pantalla mock huérfana en la app.
