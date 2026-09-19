# Mobile Fase 6 — Perfil real (backend fix + mobile)

## Objective
El Cliente autenticado no tenía forma de ver/editar su propio perfil —
`GET/PUT /api/customers/{id}` exigían el permiso `cliente.ver`, que ningún
Cliente tiene (verificado en la BD: 0 filas para el rol Cliente, solo
Administrador/Cajero/Encargado). Se agregó autogestión real
(`GET/PUT /api/customers/me`) y se conecta mobile.

## Backend — YA HECHO por el orquestador (no delegado, cambio chico)
- `backend/app/schemas/fase2.py`: `ClienteMeUpdate` (solo nombre/telefono/
  direccion — nunca idUser ni correo, esos no se editan por este flujo).
- `backend/app/routers/customers.py`: `GET /api/customers/me` /
  `PUT /api/customers/me`, registrados ANTES de `/{idCliente}` (si no,
  FastAPI intentaría parsear "me" como el int de esa ruta). Gate: JWT
  válido + tiene un Cliente asociado — SIN permiso nuevo, mismo criterio
  que `sales.py`/`reservations.py` para autocompra/autoreserva.
- Verificado en vivo: `/api/customers/me` registrado, 401 sin auth,
  import limpio.

## Contrato de backend
```
GET /api/customers/me   (auth requerido, deriva el Cliente del JWT)
  out: ClienteFull { idCliente, nombre, telefono?, direccion?, idUser, correo? }

PUT /api/customers/me
  in:  ClienteMeUpdate { nombre?, telefono?, direccion? }
  out: ClienteFull (igual que arriba)
```

## Scope mobile
- Reemplazar el header de `profile_screen.dart` (hoy `dummyUserProfile`)
  por datos reales.
- Agregar edición de nombre/teléfono/dirección — reutilizar el patrón del
  diálogo "Recalibrar Medidas" que YA existe en ese archivo (mismo estilo
  visual, mismo mecanismo de diálogo + `TextEditingController`s).
- **NO tocar**: Medidas Biométricas, AI Style Insights, Looks Guardados —
  siguen mock, no tienen modelo en el backend (limitación ya documentada
  esta sesión, no es un bug a resolver acá).

## Tasks
- [x] **T0** — Backend (`ClienteMeUpdate`, `GET/PUT /api/customers/me`).
      Hecho y verificado en vivo por el orquestador.
- [x] **T1** — `customer_model.dart` (`ClienteMe`) + `customer_service.dart`.
      `ApiClient` ganó método `put` (no existía, mirror exacto de `patch`).
- [x] **T2** — `profile_screen.dart` convertida a `StatefulWidget` (seguía
      Stateless — Fases 3/5 solo le agregaron botones sin tocar la clase).
      Header real con loading/error/reintentar.
- [x] **T3** — Diálogo "Editar Perfil" (mismo patrón que "Recalibrar
      Medidas"). Cuidado verificado: `nombre` vacío se omite del body (no
      blanquea un NOT NULL), `telefono`/`direccion` sí se mandan vacíos si
      el usuario los borra a propósito — backend usa `exclude_unset=True`,
      una clave ausente deja ese campo intacto.
- [ ] **T4** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, editar el perfil real y
      confirmar que persiste en la BD.

## Acceptance criteria
- Perfil muestra datos reales del Cliente autenticado.
- Edición persiste de verdad en la base de datos.
- Secciones mock (medidas/estilo/looks) intactas.

## Progress
- 2026-09-19: Fase 5 completada. Se detectó que "Perfil real" estaba
  bloqueado por un gap de backend genuino (permiso faltante para
  autogestión) — mismo patrón que otros gaps encontrados esta sesión
  (CU07 Ingreso de Lote, seguridad del chatbot). Usuario confirmó arreglar
  backend + mobile. Backend ya implementado y verificado en vivo. Task
  file creado, mobile delegado.

## Next step
T1-T3 implementación (delegada), T4 a cargo del usuario.
