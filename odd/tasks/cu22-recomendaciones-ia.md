# CU22 — Obtener Recomendaciones Inteligentes

## Objective
Real AI-generated product recommendations (Gemini), automatically triggered
after each completed sale, grounded in real catalog products (never an
invented product name).

## Problem / Why
`recommendations.py` (existing) is pure CRUD on a `Recomendaciones` table —
zero AI integration despite the CU22 name, and **zero frontend usage
anywhere** (grepped `web/src/app` — no hits). Only staff with
`recomendacion.gestionar` can write rows today; Cliente can only read their
own. Design gap found: `Recomendaciones.nombre` is free text with **no
`idProducto` FK** — a recommendation isn't actually linked to a real catalog
item.

## Scope decisions (user confirmed via AskUserQuestion)
1. **Trigger**: automatic, right after a sale completes (`sales.py::create_sale`),
   via FastAPI `BackgroundTasks` (no new infra — no Celery/queue in this
   project, `BackgroundTasks` is stdlib-FastAPI and matches the project's
   minimal-dependencies style). Scope boundary: only the direct
   `POST /api/sales` path (covers CU17/18/19 — digital purchase + POS).
   Reservation-confirmed sales (`reservations.py::confirm_reservation`) are
   OUT of scope for this pass — could be added later the same way.
2. **Data model fix**: add `idProducto` to `Recomendaciones` via additive
   migration `012_add_recomendacion_producto.sql` (nullable FK — existing
   rows, if any, stay valid). The AI can only ever write a recommendation
   for a product that is verified to exist (defensive re-check against the
   candidate list even though it's also constrained by the prompt).

## Design
- **Structured output, not tool-calling**: unlike CU23's chatbot, this is a
  one-shot generation, not a conversation — use Gemini's `response_schema`
  (Pydantic model) + `response_mime_type='application/json'`
  (`response.parsed` gives the validated instance directly) instead of the
  manual tool-calling loop. Verified via context7 this session.
- **Prompt inputs**: the Cliente's purchase history (products bought, reuse
  `purchase_history.py`'s query shape) + a capped candidate list of
  catalog products NOT yet purchased by this Cliente (cap ~30 to keep the
  prompt small) — Gemini picks up to 3 `idProducto` values FROM that
  candidate list with an `importancia` (Alta/Media/Baja).
- **Defensive validation**: after parsing, re-check every returned
  `idProducto` is actually in the candidate list sent — discard (log,
  don't crash) any that isn't, exactly the same "never trust, verify"
  posture as CU23's tool-calling design.
- **Replace, not accumulate**: each run deletes the Cliente's prior
  `Recomendaciones` rows before inserting the new batch — these represent
  *current* recommendations, not a history log (mirrors how the existing
  `list_recommendations` has no date filtering, so accumulating forever
  would just clutter the Cliente's list every purchase).
- **Never blocks the sale**: runs after `session.commit()` inside
  `create_sale`, in a background task with its OWN fresh `AsyncSessionLocal()`
  session (the request-scoped session closes after the response). Any
  Gemini/DB error in the background task is caught and logged, never
  surfaced to the customer — the sale already succeeded regardless of
  whether recommendations generate.

## Tasks
- [ ] **T1** — `backend/database/migrations/012_add_recomendacion_producto.sql`:
      `ALTER TABLE "Recomendaciones" ADD COLUMN IF NOT EXISTS "idProducto" INTEGER REFERENCES "producto"("idProducto") ON UPDATE CASCADE;`.
      Apply against the live `ropaDocker` (same manual-apply convention as
      migration 011 this session).
- [x] **T2** — `Recomendaciones.idProducto: Mapped[int | None]` added.
- [x] **T3** — Schemas + `recommendations.py::_serialize()` (joins Producto
      for `producto_nombre`) done.
- [x] **T4** — `recomendaciones_gemini.py`. **Live-tested with the real
      key**: idCliente=1 (only bought the Polera) → Gemini correctly
      suggested the other 3 real products with differentiated importancia
      (Jeans→Alta, Pantalón→Media, Saco→Baja), all grounded, zero
      hallucination. idCliente=2 (owns everything) → correctly returned
      early with zero candidates, left existing rows untouched. Rows left
      in DB as a working example (idRecomendacion 3-5).
- [x] **T5** — `create_sale` now schedules the background task right after
      `session.commit()`. Full existing test suite still green (12 passed,
      no regression).
- [x] **T6** — `recommendations.service.ts` (fails silently — secondary,
      non-critical load, no toast) + `catalog.component.ts` "Recomendado
      para vos" horizontal strip (only rendered when non-empty), importancia
      badges (Alta/Media/Baja), clickable to product detail via
      `selectedProductId.set(idProducto)` — turned out simpler than
      anticipated since `ProductDetailComponent` already self-fetches by id.
      `tsc --noEmit` clean.
- [ ] **T7** — Manual verification: complete a purchase as a Cliente in the
      browser, confirm new recommendations appear. **Up to the user** — the
      backend-level equivalent (direct function call) was already
      live-verified in T4.

## Acceptance criteria
- After a Cliente completes a purchase, new recommendations appear tied to
  real catalog products (never an invented name).
- The checkout/sale response is not slowed down waiting for Gemini.
- Cliente sees their recommendations somewhere in the catalog view.
- `npx tsc --noEmit` / backend import sanity both clean.

## Progress
- 2026-09-19: Diagnosed CU22 as CRUD-only with no AI and no frontend. Design
  gap found (no idProducto). User confirmed scope: auto-trigger post-sale,
  fix the idProducto gap. Verified Gemini structured-output API shape via
  context7. Task file created.

## Next step
T1 (migration) first — same live-apply flow as migration 011/006-010 this
session (`ropaDocker` is up).
