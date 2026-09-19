# CU24 — Visualizar Dashboard de Indicadores Empresariales

## Objective
Build an Administrador-only dashboard with real charts (not just numbers):
ventas por día, top productos por venta, stock por sucursal, plus KPI stat
tiles — using the aggregated data CU25's `/api/reports` endpoints already
prove out.

## Problem / Why
User asked to check whether CU24 already existed. Found: `web/src/app/features/dashboard/dashboard.component.ts`
is a generic operational home screen shown to every role — no charts (just
numeric cards + lists), no sales/revenue data at all, a hardcoded fake
"+18.4%" trend, and no Administrador gating. Does not fulfill CU24's own
definition ("Gráficos e indicadores consolidados para la alta
administración", Actor Principal: Administrador). User chose (AskUserQuestion):
build a NEW separate admin-only dashboard with real charts, leaving the
existing operational home screen untouched.

## Scope
- Backend: new `/api/dashboard` router — KPIs, daily sales series, top
  products, stock by branch. Reuses `reporte.ver` permission (no new
  migration — same actor/module as CU25).
- Frontend: new `indicadores` feature (AppView `'indicadores'`), Administrador-
  gated sidebar entry (same pattern as CU25's `canViewReports`), 3 hand-
  rolled SVG charts (no charting library in this repo — added one would be
  a new dependency for 3 charts; plain SVG matches the project's existing
  hand-rolled-Tailwind approach) + KPI stat tiles.
- Out of scope: the existing `dashboard`/`'dashboard'` AppView (operational
  home screen) — untouched, still shown to all roles.

## Design decisions (dataviz skill loaded before any chart code)
- **Palette**: validated default categorical (blue #2a78d6, orange #eb6834,
  aqua #1baf7a, ...) and sequential-blue ramp from the skill's
  `references/palette.md` — light mode only (this app has no dark mode
  anywhere, not introducing one here).
- **Forms**: ventas por día = line chart (change over time, single series,
  sequential blue, 2px line, crosshair+tooltip). Top productos = horizontal
  bar chart (magnitude comparison, categorical palette, <=24px bars, 4px
  rounded data-end, per-bar hover tooltip). Stock por sucursal = bar chart
  (2 sucursales today, categorical slots 1-2).
- **Marks**: per `marks-and-anatomy.md` — thin lines/bars, 2px surface gaps,
  gridlines hairline/recessive, selective direct labels (not one per point),
  legend for 2+ series, text never in series color.
- **Interaction**: hover tooltip on every chart (crosshair for the line
  chart, per-mark for bars), values lead/labels follow in tooltips, a table
  view alongside each chart so nothing is hover-gated.
- **KPIs**: total ventas (monto+items) en el período, stock total actual,
  productos con stock bajo (`cantidad_actual < 10`, threshold documented as
  arbitrary/adjustable).

## Tasks
- [x] **T1** — `backend/app/routers/dashboard.py` + `backend/app/schemas/dashboard.py`,
      registered in `main.py`. Verified live: all 4 routes registered
      (`/openapi.json`), reject unauthenticated requests (401), reuse the
      proven `Venta→DetalleVenta→Producto` join (not Movimiento).
- [x] **T2** — `indicadores.service.ts` + `features/indicadores/indicadores.component.ts`.
      3 charts: line chart (ventas por día, hand-rolled SVG with
      CTM-based hover hit-testing, crosshair, tooltip, table fallback,
      day-gap-filling so empty days don't compress the X axis), 2 CSS bar
      charts (top productos, stock por sucursal) with per-bar hover
      tooltips. Validated dataviz palette (categorical + sequential blue +
      status warning), "refetch keeps the frame" (opacity-60 during reload,
      no skeleton/layout jump).
- [x] **T3** — `sidebar.component.ts` (`'indicadores'` AppView,
      `canViewIndicadores` mirroring `canViewReports`), `app.component.ts`
      integration. Verified via diff — matches spec.
- [ ] **T4** — Manual verification: needs a live Administrador login in the
      browser (session has no credentials). Backend+web both running
      (`:8000`/`:3000`) for the user to test.

## Acceptance criteria
- Administrador sees a dedicated "Indicadores" view with 3 working charts +
  KPI tiles, all backed by real `/api/dashboard` data (no hardcoded fake
  deltas).
- Charts pass the dataviz skill's non-negotiables: one axis, categorical
  hues in fixed order, legend for 2+ series, hover tooltip, table view
  alternative.
- Non-Administrador roles get 403 and don't see the nav entry.
- `npx tsc --noEmit` shows no new errors.

## Progress
- 2026-09-19: Diagnosed existing dashboard doesn't fulfill CU24. User chose
  new separate admin dashboard. dataviz skill loaded, palette/marks/
  interaction specs read. Task file created.

## Next step
T1 (backend) first, then T2+T3 (frontend), same sequential single-writer
approach as CU25.
