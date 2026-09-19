# CU25 — Generar Reportes de Ventas e Inventario

## Objective
Implement CU25 from `documentacion.md` (actor: Administrador): an on-screen
filterable Sales report and an on-screen filterable Inventory report, each
exportable as CSV and PDF.

## Problem / Why
`documentacion.md:132` lists CU25 with no flow/acceptance detail beyond the
title and actor. No reports backend or frontend exists yet (confirmed by
exploration: no `reports.py` router, no PDF/CSV code anywhere in `backend/app`
or `web/src/app`). User explicitly chose scope via AskUserQuestion: on-screen
view with filters (date range, branch, product) **plus CSV and PDF export**,
for both Ventas and Inventario reports, Administrador-only.

## Scope
- Backend: new `/api/reports` router — sales report + inventory report,
  each with JSON (on-screen), CSV, and PDF variants; new `reporte.ver`
  permission (Administrador only).
- Frontend: new `reports` feature view — filter form, results table, CSV/PDF
  download buttons; Administrador-only sidebar entry.
- Out of scope: CU24 (dashboard indicators) — separate use case, not touched
  beyond what's already there.

## Constraints / decisions made (engineering judgment, not product decisions)
- **Branch attribution for sales**: `Venta` has no `idSucursal` column.
  Originally favored joining via `Movimiento` (`tipo='venta'`), but T2/T3
  implementation verified `sales.py:220-226` and found that approach broken:
  `Movimiento.motivo` (`f"Venta {idVenta}"`) is identical for every line item
  of a multi-item sale (fan-out double-counting on join), and reservation-
  confirmed sales (`reservations.py:257-264`) write `tipo="venta_reserva"`
  with a motivo that has no `idVenta` at all (that whole channel would be
  silently dropped). Implemented the `DetalleVenta→Producto→Inventario` join
  instead (filtered by `codigoSucursal` when given), with the known accepted
  tradeoff documented in code.
- **PDF library**: `reportlab` (no system deps, unlike weasyprint).
- **New permission**: `reporte.ver`, added via additive migration
  `011_reporte_permiso.sql` (insert into `permiso` + `asignacion_permiso` for
  `codigoRol=1`), never editing `base.sql` directly, per project CLAUDE.md.
- **TDD mode**: CLAUDE.md declares Strict TDD Mode enabled globally, but this
  repo has **no configured test runner** (no pytest in `backend/requirements.txt`,
  no test script in `web/package.json` — the one existing web test file,
  `product-detail-error.test.ts`, runs ad hoc via `node --test` against a pure
  exported function). Resolution: extend that exact existing pattern rather
  than importing new test frameworks — add `pytest` + `httpx` to backend
  (minimal, stdlib-adjacent) for RED/GREEN tests of the pure aggregation
  helpers, and add `node --test` files for pure frontend helpers (filter
  validation, CSV row shaping), following `product-detail-error.test.ts`
  exactly. Full endpoint/e2e coverage is out of scope — kept to pure-logic
  units, consistent with the one precedent in the repo.
- **Delivery strategy**: `ask-on-risk` (default). RDD is `on` (global).

## Branch
`feature/cu25-reportes-ventas-inventario` (created off `main`, which was the
active branch at task start — pre-existing uncommitted unrelated changes on
`main` carry over and are left untouched).

## Tasks

- [x] **T1** — Migration `011_reporte_permiso.sql` written (permiso
      `reporte.ver` + assignment to Administrador `codigoRol=1`). **NOT yet
      applied** — `ropaDocker` container is down, user said to proceed
      without waiting; apply manually once the container is up (see T7).
- [x] **T2** — Backend: `backend/app/schemas/reports.py` +
      `backend/app/routers/reports.py` (6 endpoints, `require_permiso("reporte.ver")`).
      Registered in `main.py`. Join strategy revised during implementation —
      see Constraints above.
- [x] **T3** — Backend: CSV + PDF export endpoints (reportlab added to
      `requirements.txt`, pinned `reportlab==4.2.5`). Pure helper functions
      extracted (`_shape_*_rows`, `_sales_totals`, `_describe_filtros`,
      `_*_rows_to_csv`, `_*_rows_to_pdf_bytes`). `backend/tests/test_reports.py`
      — 12 tests, RED (ModuleNotFoundError) confirmed then GREEN (12 passed)
      in a throwaway venv (repo's `backend/.venv` is corrupted — 28-byte
      placeholder binaries, pre-existing environment issue unrelated to this
      task, flagged for the user separately). `pytest==8.3.4`/`httpx==0.28.1`
      added to `requirements.txt`.
- [x] **T4** — `web/src/app/core/services/reports.service.ts`: JSON fetch +
      blob download (`triggerBlobDownload` helper) for CSV/PDF, matching
      `sales.service.ts`/`inventory.service.ts` conventions. Types added to
      `web/src/app/core/models/index.ts`.
- [x] **T5** — `web/src/app/features/reports/reports.component.ts`: Ventas/
      Inventario tabs, filter forms (fecha/sucursal/producto), results
      tables + totals row, Ver/Descargar CSV/Descargar PDF buttons. Pure
      helpers in `reports-filters.ts` (`validateDateRange`, `buildSalesFiltros`,
      `buildInventoryFiltros`) with `reports-filters.test.ts` — RED
      (`ERR_MODULE_NOT_FOUND`) then GREEN (4/4 passed). **Run command
      correction**: `node --test`/`--experimental-strip-types` alone do NOT
      resolve extensionless TS imports in this repo — the working command is
      `node --import tsx --test <file>` (uses the `tsx` devDependency already
      in `web/package.json`). This also applies to the pre-existing
      `product-detail-error.test.ts` — it was never actually runnable with a
      bare `node --test` in this environment either.
- [x] **T6** — `sidebar.component.ts`: `AppView` gained `'reports'`, new
      `canViewReports` getter (`permisos.includes('reporte.ver')`, mirrors
      the existing `canOpenPos` pattern), permission-gated nav button (first
      one in this codebase). `app.component.ts`: registered `ReportsComponent`,
      added the `'reports'` case to `getViewTitle`. Verified via `git diff` —
      matches report, `npx tsc --noEmit` shows only the known pre-existing
      `./index.css` error.
- [ ] **T7** — Manual verification: start backend + web, log in as
      Administrador, exercise filters, verify CSV/PDF downloads open
      correctly, verify a non-Administrador role cannot see/access the
      report endpoints (403). **Blocked**: `ropaDocker` container is down.

## Acceptance criteria
- Administrador can view Ventas and Inventario reports on screen, filtered by
  date range / sucursal / producto.
- Administrador can download each report as CSV and as PDF, reflecting the
  active filters.
- Non-Administrador roles get 403 from `/api/reports/*` and don't see the nav
  entry.
- `npx tsc --noEmit` in `web/` shows no new errors (the pre-existing
  `./index.css` error in `main.ts` is expected, per project CLAUDE.md).
- New pure-logic tests (backend pytest, frontend `node --test`) pass.

## Progress
- 2026-09-18: Task file created after exploration + scoping question
  answered by user. No source files written yet.
- 2026-09-18/19: T1-T6 implemented across two delegated writers (backend,
  frontend). All changes left UNCOMMITTED in the working tree per this
  project's CLAUDE.md ("prohibido hacer commits" — only the user commits).
  Two pre-existing environment corruptions discovered and worked around
  (not caused by this task): `backend/.venv` and `web/node_modules` both had
  their binaries/symlinks replaced by tiny placeholder text files — matches
  the project's documented environment-rollback issue. `web/node_modules`
  was repaired via `pnpm install` (no lockfile/package.json change);
  `backend/.venv` was NOT repaired (backend tests were run in a throwaway
  scratch venv instead) — **the user will need to rebuild `backend/.venv`
  before running the real backend**.
- RDD (receipt-driven development) is on globally, but its review flow is
  commit-based (`--committed-only`) and this project forbids agents from
  committing — native review was not invoked. Delivery (commit/push/PR)
  remains entirely the user's own action per ordinary repository policy.

## Next step
T1's migration is written but not applied (`ropaDocker` was down all
session). T7 (manual verification) needs a live backend + DB. Once the user
has the container up: rebuild `backend/.venv`, apply migration 011, start
backend + web, and manually verify CU25 end-to-end.
