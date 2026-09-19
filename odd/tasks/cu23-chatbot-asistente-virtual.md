# CU23 — Interactuar con Asistente Virtual / Chatbot

## Objective
Chatbot widget for the Cliente role, backed by Google Gemini (not Anthropic —
user has no budget for Anthropic's paid-only API; Gemini has a real free
tier). Can answer catalog questions and look up the authenticated Cliente's
own ventas/reservas.

## Problem / Why
documentacion.md CU23: Actor Principal Cliente, Actor Secundario "Servicio de
IA (Sistema Externo)". No AI provider integration exists anywhere in this
codebase yet (grepped — zero hits for openai/anthropic/gemini/genai in
backend). `recommendations.py` (CU22) is NOT an AI integration despite the
use-case name — it's plain CRUD on a `Recomendaciones` table. CU23 is the
first real LLM integration in this project.

## Scope decision (user confirmed via AskUserQuestion)
Catálogo + pedidos/reservas del cliente (not catalog-only). The chatbot can:
1. Answer questions about products (search catalog).
2. Answer "¿dónde está mi pedido/reserva?" by querying the AUTHENTICATED
   Cliente's own Ventas/Reservas — never an arbitrary idCliente (security
   boundary: the tool functions close over the JWT-derived idCliente, they
   never accept one as a Gemini-supplied argument).

## Provider & SDK (verified via context7 against current docs — training
data would have been stale/wrong here)
- **Package**: `google-genai` (current). NOT `google-generativeai` — that
  package is deprecated (critical-bug-fixes only), and it's what an
  un-verified implementation would likely have reached for.
- **Client**: `from google import genai; client = genai.Client(api_key=settings.GEMINI_API_KEY)`
  — explicit `api_key=`, not ambient env-var auto-pickup, matching how
  `STRIPE_SECRET_KEY` is already handled in `config.py`.
- **Async**: use `client.aio.models.generate_content(...)` (the app is
  async-everywhere — every other router uses `AsyncSession`).
- **Model**: `gemini-flash-latest` (a rolling alias to the current Flash
  model — cost-efficient, supports tool use, no version to manually bump;
  reasonable default for a free-tier budget-conscious project). Pin to a
  specific dated model instead if the user wants output stability over
  always-latest.
- **Tool calling**: use the MANUAL loop (`automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)`,
  inspect `response.function_calls`, run each tool function yourself, feed
  `function_response` parts back), NOT the SDK's automatic function calling.
  Reason: automatic function calling's async-function support isn't
  confirmed in the docs pulled this session, and the manual loop is the
  well-documented, universally-safe path — it also makes the security
  boundary above (idCliente closure) explicit and auditable in the route
  handler rather than implicit inside SDK-driven execution.
- **History**: kept in the BROWSER (frontend signal), not a new DB table.
  Each `POST /api/chat` request sends the full prior turns + the new
  message; the backend rebuilds an ephemeral `client.aio.chats.create(...,
  history=[...])` (or equivalent `contents=[...]` list) per request and
  returns the updated history for the frontend to keep. No new persistence
  layer, no new migration.

## Tasks
- [x] **T1** — `GEMINI_API_KEY` added to `config.py`. `google-genai==2.24.0`
      added to `requirements.txt` (also had to bump `pydantic` 2.10.4→2.13.5
      — google-genai's install pulled a pydantic-core requiring it; verified
      the whole app + all 12 CU25 tests still pass at the new version).
- [x] **T2** — `backend/app/schemas/chat.py`: `ChatMensaje`/`ChatIn`/`ChatOut`.
- [x] **T3** — `backend/app/services/chat_gemini.py`. Caught a real bug via
      context7 mid-implementation: the manual tool-calling loop's function-
      response `Content` needs `role='tool'`, not `role='user'` as first
      drafted. Security boundary verified by reading the file: `id_cliente`
      never appears in the `FunctionDeclaration` schemas Gemini sees, only
      closed over per-request from the JWT-resolved Cliente.
- [x] **T4** — `backend/app/routers/chat.py`, registered in `main.py`.
      Verified live: `/api/chat` registered, 401 without auth confirmed.
- [x] **T5** — `chat.service.ts`, `chat-widget.component.ts` (floating
      bubble `right-24` to avoid overlapping the toast container's
      `right-6`), mounted in `customer-shell.component.ts` outside the
      view-switch (floats above catalog/reservations/profile). `mensajes`
      (display, includes a local-only greeting) kept separate from
      `historial` (network payload, always the backend's echoed value,
      never hand-appended). `tsc --noEmit` clean.
- [x] **T6** — User set `GEMINI_API_KEY`. Live-tested `responder_chat()`
      directly against the real Gemini API + real DB: "que camisas tenes"
      correctly answered "no tengo" (no Camisa-type product exists — no
      hallucination), "tenes alguna polera?" correctly answered with the
      real seeded product (Polera Oversize Cotton, Negro, L, 120) — full
      tool-calling loop confirmed working end-to-end. **Model changed**
      `gemini-flash-latest` → `gemini-2.5-flash`: the rolling-latest alias
      returned a live 503 "high demand" from Google; the pinned version
      responded immediately. Browser-level manual test (widget UI, login
      flow) still up to the user.

## Acceptance criteria
- Cliente sees a chat widget, can ask catalog questions and get accurate
  answers grounded in real `/api/products` data (not hallucinated).
- Cliente can ask about their own orders/reservations and get a correct,
  real answer sourced from the DB.
- The chatbot cannot be made to return another Cliente's ventas/reservas
  (tool functions never accept a client-supplied idCliente).
- `npx tsc --noEmit` shows no new errors. Backend imports cleanly.
- If `GEMINI_API_KEY` is unset, the endpoint fails with a clear error
  message, not a stack trace (mirror `StripeNoConfigurado`'s pattern).

## Progress
- 2026-09-19: User initially asked about Anthropic, then switched to Gemini
  (no budget for a paid-only API — Gemini's free tier fits). Verified
  current `google-genai` SDK shape via context7 (avoided the deprecated
  `google-generativeai` package and stale model names training data would
  have produced). Task file created.

## Next step
Waiting on the user to obtain a `GEMINI_API_KEY` from
https://aistudio.google.com/apikey before T1 can be fully wired end-to-end
— but T1-T5 code can be written now (the key only needs to exist at
request time, not at code-writing time).
