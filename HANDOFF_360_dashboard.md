# Handoff — Native 360 / Spin dashboard (replaces the tracker360 iframe)

> Context doc for a fresh chat. The core dashboard is **deployed and LIVE on prod**
> (`main`, Vercel). A set of **follow-ups** (spin VIN indexes / migration 016, the
> SpinDashboard remount fix, and UI polish) may be in a **later commit** — check
> `git log`/`git status` before assuming they're shipped.

---

## 1. Why this work exists

The "360 Tracker" top-level module used to embed an **external iframe**
(`360-tracker-dashboard-tau.vercel.app`). Now that the expanded VIN card emits a parallel
**360 Spin** processing funnel (see `HANDOFF_publishing_rollout.md` for the card story), we
replaced that iframe with a **native dashboard** that mirrors the VIN-tracker layout but is
driven entirely by the spin columns already in `public.vins`.

The 6 spin columns (ingested earlier, migration 014) mirror the catalog funnel one-to-one:

| Catalog            | Spin                       | Meaning                              |
| ------------------ | -------------------------- | ------------------------------------ |
| `output_processing_catalog` | `output_processing_spin` | 0/1 — VIN is in the 360 funnel ("requested") |
| `status`           | `spin_status`              | Delivered / Not Delivered / No Photos |
| `reason_bucket`    | `spin_reason_bucket`       | spin pending reason (6 buckets)      |
| `after_24h`        | `spin_after_6h`            | pendency >6h                         |
| `processed_at`     | `spin_sent_at`             | spin delivery timestamp              |
| `is_qc_on`         | `spin_qc_on`               | spin QC enabled                      |

**Updated Metabase card = `fd2018d7-7047-405d-a83a-05da8112f523`** (37 cols). The old default
`a8842975-…` is now a stale 30-col card. Prod uses `fd2018d7` via `VIN_CARD_URL` (Vercel env).

**Goal:** full parity with the VIN tracker — Overview + Rooftop View + Enterprise View + VIN Data,
all spin-scoped — while leaving the catalog ("VIN Tracker") module **100% unchanged**.

---

## 2. Architecture — one `track` param, reuse everything

A single **`track`** query param (`'catalog'` default | `'spin'`) is threaded through every read
endpoint: `/api/summary`, `/api/vins` (+`/export`), `/api/rooftops`, `/api/enterprises`,
`/api/filter-options`. Catalog is always the default, so **every catalog code path is unchanged**.
The frontend `<SpinDashboard>` calls the same endpoints with `track=spin` and reuses the same tab
components (`OverviewTab` / `RooftopTab` / `EnterpriseTab` / `RawTab` / `SummaryTable`).

### The 360 funnel (REORDERED vs catalog — important)

The spin Overview funnel is scoped to the **requested** set, with **With Photos nested under
Requested**:

1. **Total Inventory** = `COUNT(*)` (global)
2. **360 Requested** = `output_processing_spin = 1`  (% of total)
3. **With Photos** = requested `AND has_photos = 1`  (% of 360 requested)
4. **360 Delivered** = requested `AND spin_status='Delivered' AND has_photos`  (% of with photos)
5. **360 Pending** = requested `AND spin_status='Not Delivered' AND has_photos`  (% of with photos)

Plus a **"360 Pending >6h"** card (`… AND spin_after_6h=1`) with spin reason-bucket pills, and
spin-scoped *By Rooftop Type* / *By CSM* tables (their "Inventory" column = 360 Requested).

- **Spin reason buckets are a subset of 6**: Sold, Upload Pending, QC Hold, QC Pending,
  Processing Pending, Others (no Missing VIN Name / Scheduled Push / Publishing Pending). The 3
  catalog-only buckets are zero-filled so the shared serializers/components are reused unchanged.
- **`output_processing_spin` NULL → 0** (NOT requested — legacy cards never emitted spin), unlike
  catalog's `output_processing_catalog` NULL → 1. This is the #1 thing to check if the requested
  count is ever wrong.

---

## 3. How to run / test locally

Same setup as the publishing rollout (separate test DB in `database_url.test.env`, or read-only
against prod). Spin **Overview / VIN Data** read `vins` directly and work without the MV migration;
spin **Rooftop / Enterprise 'all'-scope** + `filter-options?track=spin` need the MVs to have the
`spin_*` columns (migration 015), so they 500 until that's applied.

```bash
PORT=3013 node --env-file=database_url.test.env server/index.js   # initSchema builds spin MV cols + indexes
curl -X POST http://localhost:3013/api/sync                       # populates spin:* cache keys + MVs
# spot-check the funnel:
curl -s "http://localhost:3013/api/summary?track=spin" | python3 -c 'import sys,json;t=json.load(sys.stdin)["totals"];print(t["spinRequested"],t["spinDeliveredWithPhotos"],t["spinPendingWithPhotos"])'
```

> ⚠️ `npm run server`/`migrate` hardcode `--env-file=database_url.env` = **PROD**. Use `node`
> directly with the test env for new-code testing.
> ⚠️ Materialized-view columns are **not** in `information_schema.columns` — use `pg_matviews` /
> `pg_attribute` to inspect them (this caused a false "spin columns missing" alarm during the build).

---

## 4. What's DONE

### A. Backend ([server/app.js](server/app.js), [server/db.js](server/db.js))
- **Resolvers/generators** near `pendencyPredicate6h` (now `(alias, track)`): `trackCols(track)`,
  `spinBucketCols(guard)` (6 real + 3 zero-filled), `spinAggCols()` (inline CTE path),
  `SPIN_MV_ALIAS_COLS` (MV path), `ALL_BUCKET_COLS` / `SPIN_BUCKET_LABEL_BY_COL`.
- **`computeSummary(dateFilter, publishing, track)`** branches to **`computeSpinSummary()`** — a
  parallel query: global `total`, the reordered funnel scalars, by_csm/by_type/by_rooftop over the
  **requested subset (`req` CTE)**, spin `by_bucket` (6 labels, own ORDER BY). `toTotals` gained
  `spinRequested / spinWithPhotos / spinDeliveredWithPhotos / spinPendingWithPhotos` (null for catalog).
- **`/api/summary`**: `track`-aware cache key → catalog stays `all/on/off`, spin = `spin:all/on/off`.
  `runSync` precomputes **both tracks** (nested loop) and the stale-eviction whitelist was widened to
  keep the 3 spin keys.
- **`/api/vins`** (+`/export`, `/raw`): `vinSelect(track)` aliases spin cols → catalog field names
  (so `toApiRow`/`RawTab` unchanged); `SPIN_SORT_MAP` + `buildVinSort(opts, track)`;
  `buildVinFilters(qp, track)` maps status/reason/pendency to spin cols and adds a **`spinRequested`**
  filter (`COALESCE(output_processing_spin,0)=1`).
- **`buildRooftopSource(…, track)`** / **`buildEnterpriseSource(…, track)`**: 'all' scope reads the MV
  via `SPIN_MV_ALIAS_COLS`; on/off scope builds an inline CTE via `spinAggCols()`. Serializers unchanged.
- **`computeFilterOptions(track)`** reads the MV's `spin_bucket_*` flags; cached under a 2nd
  `filter_cache` row id `'spin'`. `/api/filter-options?track=spin`. runSync precomputes both.
- **Materialized views** (`v_by_rooftop` / `v_by_enterprise`) gained parallel `spin_*` columns
  (`SPIN_MV_COLS` in db.js). **Migration 015** drops them so `initSchema`'s `CREATE … IF NOT EXISTS`
  rebuilds with the spin columns (mirrors 012/013).
- **Migration 016** + db.js indexes: `idx_vins_output_processing_spin`,
  `idx_vins_spin_status_photos_6h (spin_status, has_photos, spin_after_6h)`,
  `idx_vins_spin_reason_bucket` — so the spin VIN-Data list isn't a seq-scan. *(follow-up; may be a later commit)*

### B. Frontend ([inventory-dashboard.tsx](inventory-dashboard.tsx))
- **`SPIN_BUCKETS`** (6) + **`SPIN_DEFAULT_FILTERS`** (= `DEFAULT_FILTERS` + `spinRequested:true`).
- A **`buckets` prop** (defaults `BUCKETS`) on `SummaryTable` / `FilterBar` / `RawTab` / `RooftopTab` /
  `EnterpriseTab` — catalog call sites unchanged; spin passes `SPIN_BUCKETS`.
- **`OverviewTab variant="spin"`** renders the 5-card reordered funnel + "360 Pending >6h".
- **`<SpinDashboard>`** — self-contained component (own state + loaders that append `&track=spin` +
  effects + drill handlers that inject `spinRequested:true`). Rendered for `module==='tracker360'`
  (the iframe + `TRACKER_360_URL` were removed).
- **Remount fix**: `SpinDashboard` owns its state, so conditional-rendering it reloaded on every
  module switch. Now a `tracker360Opened` flag mounts it once and keeps it mounted but **hidden**
  (`display:none`) when inactive, so data persists. *(follow-up; may be a later commit)*
- **Publishing removed from 360** via a **`hidePublishing`** prop (defaults false → catalog untouched):
  the All/On/Off header toggle (360 pinned to 'all'), Pub On/Off + Pub Disabled columns
  (SummaryTable/EnterpriseTab), the Rooftop publishing column + filter, and the VIN-Data Publishing
  column + filter. *(follow-up; may be a later commit)*
- **`smallGrey` StatCard mode** for the 360 KPIs: smaller grey label/sub, and the % subtitle stacked
  **below** the number instead of wrapping beside it. *(follow-up; may be a later commit)*

---

## 5. Locked decisions (from the user)

1. **Full parity**: Overview + VIN Data + Rooftop + Enterprise (Report Status excluded — email-specific).
2. **Funnel order**: 360 Requested comes *before* With Photos; With Photos is computed *within* the
   requested set; Delivered/Pending are % of With Photos.
3. **Catalog must stay 100% unchanged** — hence the `track`/`buckets`/`hidePublishing` props all default
   to catalog behavior; catalog SQL is literal, spin is additive/parallel.
4. **No publishing on/off anywhere in the 360 tracker.**
5. KPI grey text smaller + stacked below the number.

---

## 6. Key files

- [server/app.js](server/app.js) — `trackCols`/`spinBucketCols`/`spinAggCols`/`SPIN_MV_ALIAS_COLS`,
  `pendencyPredicate6h(alias,track)`, `computeSummary`/`computeSpinSummary`, `toTotals`,
  `summary_cache` keying + `runSync` precompute, `vinSelect`/`SPIN_SORT_MAP`/`buildVinFilters`,
  `buildRooftopSource`/`buildEnterpriseSource`, `computeFilterOptions`, the read endpoints.
- [server/db.js](server/db.js) — `SPIN_MV_COLS` in both MV CREATEs; spin VIN indexes in `initSchema`.
- `server/migrations/014_add_vin_spin_columns.sql` (ingest), `015_add_spin_matview_cols.sql`
  (drop MVs → rebuild with spin cols), `016_add_spin_vin_indexes.sql` (spin indexes).
- [inventory-dashboard.tsx](inventory-dashboard.tsx) — `SPIN_BUCKETS`, `SPIN_DEFAULT_FILTERS`,
  `buckets`/`hidePublishing` props, `OverviewTab variant="spin"`, `StatCard smallGrey`,
  `<SpinDashboard>`, the `tracker360Opened` mount-persist logic.

---

## 7. Verification

Prod numbers drift slightly with each sync; what matters is **MV sum == API summary**. Latest seen
(317,065 total): **360 Requested 68,723 / With Photos 67,398 / Delivered 58,379 / Pending 9,019**.

- `summary_cache` holds `all/on/off` **and** `spin:all/on/off` (same `computed_at` per sync).
- `filter_cache` has rows `global` **and** `spin`.
- `v_by_rooftop` has 13 `spin_*` columns; `SUM(spin_requested)` etc. == the `?track=spin` summary.
- Spin `summary` / `vins` / `rooftops` / `enterprises` / `filter-options` all return **HTTP 200**.
- Catalog `/api/summary` (no track) byte-identical to before.

So the 360 tracker is **cached at full parity** with catalog: Overview→`summary_cache`,
filters→`filter_cache`, Rooftop/Enterprise→MVs. Only the VIN-Data row list is a live `vins` query
(like catalog's — now indexed by migration 016).

---

## 8. NOT done / next steps

- **Confirm the follow-up commit landed** (migration 016, remount fix, publishing removal, KPI text).
  If pushed, Vercel build runs migration 016 (creates 3 indexes, brief write lock on `vins`).
- **Browser smoke-test** the remount fix: 360 → VIN → 360 should NOT re-show the loading screen.
- **Durable perf fix for the card**: `fd2018d7`'s query is ~2.3 min to first byte; the sync fetch
  timeout was raised 180s→270s to fit under Vercel's 600s `maxDuration`. If syncs get slower, optimize
  the card's `360_spin` CTEs / activity-log scans rather than bumping the timeout again.
- **No 360 emailers** — this is dashboard-only (catalog daily emailers are untouched).

---

## 9. Gotchas / lessons

- **Materialized-view columns aren't in `information_schema.columns`** — use `pg_matviews` /
  `pg_attribute`. (Caused a false "spin MV columns missing" alarm.)
- **Migration 015 drops + recreates the MVs**; there's a brief deploy window before `initSchema`
  rebuilds them (same as 012/013). The recreate keeps all catalog columns, so catalog never breaks.
- **db.js SQL lives in JS template literals** — no backticks in the SQL.
- **Keep the catalog path literal**: every new param defaults to catalog; spin is a parallel branch.
  Verify catalog numbers are unchanged after any edit here.
- A separate **`tracker360.vins`** table (schema `tracker360`, the old iframe product) has its own
  `spin_processing_status`/`spin_qc_status` cols — **unrelated** to `public.vins`. Don't confuse them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
