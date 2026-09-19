# Mobile Fase 1 — Infraestructura + Auth real + Catálogo real

## Objective
Conectar la app Flutter al backend real por primera vez: capa de red, login/
registro funcionales (hoy son decorativos), y que Home/Colección muestren
productos reales en vez de `dummyProducts`. **Solo Android** — no se toca
iOS ni web (usuario confirmó).

## Problem / Why
Auditoría (agente read-only) confirmó: cero paquete HTTP, cero cliente API,
cero almacenamiento seguro de token, en todo `mobile/app/lib/`. `login_screen.dart`
existe pero es decorativo — cualquier input (o ninguno) entra igual, "Iniciar
sesión" y "Continuar como Invitado" llaman al mismo método sin validar nada.
Todo el estado (`AppState`, `ChangeNotifier`) se siembra una sola vez desde
constantes `dummy*` y nunca toca la red.

## Scope decision (usuario confirmó vía AskUserQuestion, sobre 10 fases
propuestas por la auditoría)
Fase 1 únicamente: infraestructura + auth + catálogo de lectura. Fases 2+
(perfil, checkout con Stripe mobile, reservas, historial, recomendaciones/
chat, citas) quedan para otra sesión — citas en particular está bloqueada
del lado del backend (no existe el endpoint), no es solo trabajo de mobile.

## Hard constraint (igual que CU11)
No hay toolchain de Flutter en este entorno — no se puede compilar ni
correr. El usuario debe correr `flutter pub get && flutter analyze` y
probar en un emulador/dispositivo Android antes de confiar en esto.

## Design

### Infraestructura
- Paquetes: `http` (cliente HTTP simple, coherente con el resto del
  proyecto que no usa nada pesado) + `flutter_secure_storage` (token JWT,
  usa Android Keystore — con el alcance Android-only esto es directo, sin
  las complicaciones de Keychain/iOS).
- `lib/config/api_config.dart`: base URL configurable. Un emulador Android
  NO puede usar `localhost` para llegar a la máquina host — necesita el
  alias especial `10.0.2.2`. Default: `http://10.0.2.2:8000`, con un
  comentario explicando cómo cambiarlo para un dispositivo físico en la
  misma red (IP LAN de la máquina que corre el backend).
- `lib/services/api_client.dart`: wrapper HTTP — headers JSON, inyección
  del bearer token (leído de secure storage), parseo de errores (el
  backend devuelve `{"detail": "..."}`, mismo patrón que ya usa la web).

### Auth (login real + registro nuevo — no existía)
- Backend real (`backend/app/schemas/auth.py`/`routers/auth.py`, ya leído
  esta sesión): `POST /api/auth/login` (`LoginRequest{email,password}` →
  `TokenResponse{access_token,refresh_token,token_type,user:{idUser,nombre,
  correo,rol,permisos}}`), `POST /api/auth/register`
  (`RegisterRequest{nombre,email,password}`, misma regla de contraseña que
  el resto del proyecto: min 10 caracteres, 1 minúscula, 1 mayúscula, 1
  número, 1 especial — `validate_password_strength` server-side, pero
  replicar la validación en el form del lado cliente para feedback
  inmediato). Login maneja bloqueo progresivo con status HTTP 423 y
  mensajes específicos — el cliente debe mostrar el mensaje real del
  backend (`detail`), no un genérico.
- `lib/services/auth_service.dart`: `login()`, `register()`, `logout()`
  (borra el token de secure storage), lee/expone el usuario actual.
- `AppState` gana: `isAuthenticated`, `currentUser`, `authLoading`,
  `authError` — y pasa a tener métodos async donde corresponde (hoy todos
  sus métodos son síncronos e infalibles).
- `login_screen.dart`: conectar de verdad — quitar el email/password
  pre-rellenado falso, validar el form, llamar a `authService.login()`,
  mostrar el error real en fallo (incluido el mensaje de bloqueo). Agregar
  un flujo de registro (pantalla nueva o modo alternativo en la misma
  pantalla — decisión del implementador según cómo esté armada la UI
  existente). "Continuar como Invitado" se mantiene pero pasa a significar
  honestamente "navegar el catálogo sin sesión" (el catálogo es público,
  GET no requiere auth) — no debe seguir actuando como un login falso.

### Catálogo real
- Backend: `GET /api/products` (paginado, filtros tipo/talla/color/
  idColeccion/idProveedor/q), no requiere auth.
- **Desajuste de modelo de datos a resolver, no ignorar**: el `Product`
  local de Flutter asume UN producto con una LISTA de tallas seleccionable
  (`sizes: List<String>`). El backend real es por-variante: cada
  combinación talla/color es su propia fila con su propio `idProducto`
  (mismo modelo que ya usa la web). Para esta fase (que NO incluye
  `try_on_screen.dart`, eso es fase 4), no hace falta resolver el selector
  de talla — solo mapear lo necesario para las grillas de Home/Colección:
  `idProducto→id (string)`, `nombre→name`, `venta→price`, `imagen_url→imageUrl`,
  `tipo→category`, `talla→sizes` (lista de un solo elemento, honesto sobre
  la limitación), `color`→ usar como `colorName` (no hay hex real del
  backend — dejar `colorHex` en un valor neutro fijo o derivarlo con un
  mapeo simple color-nombre→hex aproximado, documentado como aproximación).
- `lib/services/products_service.dart`: `getProducts({filtros, page})`.
- `home_screen.dart` / `collection_screen.dart`: reemplazar
  `appState.products` (dummy) por datos reales cargados vía el nuevo
  servicio: loading/error states donde hoy no existe ninguno.

## Tasks
- [x] **T1** — `http: ^1.2.0`, `flutter_secure_storage: ^9.2.0` agregados
      (estimadas, no verificadas — correr `flutter pub outdated`).
- [x] **T2** — `api_config.dart` (`10.0.2.2:8000`) + `api_client.dart`
      (spot-check del orquestador: limpio, `ApiException` con el mensaje
      real del backend, mismo patrón que la web toda la sesión).
- [x] **T3** — `auth_service.dart` (login/register/logout/tryRestoreSession
      — esta última valida contra `GET /api/auth/me`, no confía ciegamente
      en un token guardado) + `AppState` extendido (aditivo, estado previo
      intacto).
- [x] **T4** — `login_screen.dart` reescrita de verdad. `register_screen.dart`
      nueva (no existía ninguna). Bonus no pedido explícitamente pero
      correcto: `splash_screen.dart` nueva, corre `AppState.bootstrap()`
      (restaura sesión + precarga catálogo) antes de decidir Welcome vs.
      MainShell — `main.dart` ahora arranca en `SplashScreen`.
- [x] **T5** — `products_service.dart`, mapeo documentado (desajuste
      talla/color como aproximación explícita en comentarios, no oculto).
- [x] **T6** — `home_screen.dart`/`collection_screen.dart` con loading/error
      state real. Chips de filtro de Colección quedaron hardcodeados
      (fuera de alcance de esta fase, como se indicó).
- [ ] **T7** — Verificación de usuario (bloqueada acá, sin toolchain):
      `flutter pub get && flutter analyze`, probar en emulador/dispositivo
      Android real contra el backend corriendo en `localhost:8000` (usar
      `10.0.2.2` desde el emulador). Confirmar: registro crea un Cliente
      real (verificable en la BD), login rechaza credenciales malas con el
      mensaje real del backend, catálogo muestra productos reales de la BD.

## Acceptance criteria
- Login/registro reales contra el backend, token JWT persistido de forma
  segura, sobrevive a un restart de la app.
- Bloqueo progresivo del backend se refleja con el mensaje real (no un
  error genérico).
- Home/Colección muestran productos reales de la base de datos, no
  `dummyProducts`.
- `flutter analyze` sin errores nuevos (verificado por el usuario).

## Progress
- 2026-09-19: Auditoría completa confirmó desconexión total. Usuario
  confirmó alcance Fase 1 (infra+auth+catálogo) y aclaró Android-only. Task
  file creado con el shape exacto de los endpoints de auth ya verificado
  contra el código del backend.

## Next step
T1-T3 (infraestructura + auth) primero — todo lo demás depende del cliente
API y del token. Luego T5-T6 (catálogo).
