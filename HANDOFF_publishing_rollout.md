# Handoff — VIN Tracker "publishing-OFF" rollout (dashboard + customer emailers)

> Context doc for a fresh chat. All work below is **uncommitted** on branch
> **`feat/vin-publishing-on-off`** (pushed to origin earlier; later commits are local only).
> Nothing is in prod yet — prod still pulls the OLD Metabase card.

---

## 1. Why this work exists

The VIN Tracker historically tracked **only publishing-ON rooftops** (~145k VINs). The publishing filter
was baked into the production Metabase VIN card. A **new Metabase VIN card**
`a8842975-bdb4-49f1-b980-93aae93007fc` adds **publishing-OFF** rooftops too (~425k VINs, ~1,409 teams,
~734 enterprises) and two new per-row columns: **`is_publishing`** (0/1) and **`is_qc_on`** (0/1). It also
carries **`status_overallStatus`** (DONE/FAILED/DRAFT/…).

Goal: ingest the expanded data, surface a publishing On/Off dimension in the dashboard, and make the
customer daily emailers publishing-aware — all without disturbing prod until a deliberate cutover.

Data shape (from the synced test DB; live numbers drift a little):
- Publishing-ON teams ≈ **893**, publishing-OFF ≈ **516**. ON VINs ≈145k, OFF ≈280k.
- Enterprises with ≥1 publishing-on rooftop ≈ **346**; of those **27 are "mixed"** (have both on + off rooftops).
- `is_publishing` reconciles **100%** with `rooftop_details.publishing_status` ('true'/'false').

---

## 2. How to run / test locally (NEVER against prod)

Testing is done against a **separate Supabase test DB** (not prod). Config lives in
**`database_url.test.env`** (gitignored): `VIN_TRACKER_DATABASE_URL` = test DB, and
`VIN_CARD_URL` = the new card's `/query/json` URL.

```bash
# backend (new code) on a chosen port; initSchema builds the full schema on boot
PORT=3013 node --env-file=database_url.test.env server/index.js
# trigger a sync (fetches the new card, ~2–3 min for ~425k rows)
curl -X POST http://localhost:3013/api/sync
# frontend (optional, for the dashboard): vite proxies /api -> :3002
npm run dev
```

> ⚠️ The npm scripts (`npm run server`/`migrate`) hardcode `--env-file=database_url.env` = **PROD**. To test,
> run `node` directly with `--env-file=database_url.test.env` (as above). Don't `npm run server` with a test card set.

> ⚠️ The user's own backend may already be on **:3002** (often the OLD code). Use a different port for new-code testing.

---

## 3. What's DONE

### A. Ingest / schema ([server/db.js](server/db.js), [server/app.js](server/app.js))
- `vins` table gained **`is_publishing SMALLINT`**, **`is_qc_on SMALLINT`**, **`status_overall_status TEXT`**
  (CREATE + idempotent `ALTER … IF NOT EXISTS`) + migrations **`009_add_vin_publishing_qc.sql`** and
  **`010_add_vin_status_overall.sql`**. Index `idx_vins_is_publishing`.
- `syncVins()` parses the 3 new CSV fields (`is_publishing`, `is_qc_on`, `status_overallStatus`) into
  `VIN_COLUMNS` + the UNNEST insert.
- **CSV parser hardened**: `fetchFromMetabase` now uses `relax_quotes: true` + `relax_column_count: true`
  (a dirty `vdp_url` with a stray `"` was aborting the whole 187 MB pull with "Invalid Opening Quote").
- `VIN_CARD_URL` env override added (keeps the prod card const as the default; unset in prod = no change).

### B. Dashboard (frontend [inventory-dashboard.tsx](inventory-dashboard.tsx) + read APIs in app.js)
- **Global header toggle changed from date filter → Publishing scope** `All / On / Off` (`pubScope`,
  default All, localStorage). The old "Post/Pre/All 1st Apr" date toggle is **commented out** (not deleted);
  `dateFilter` is pinned to `'all'`. `pubScope` threads into every read path via a new
  `getPublishingCondition()` helper (mirrors the old `getDateCondition` plumbing). On/Off summaries compute
  fresh (not cached) to avoid stale `summary_cache`.
- **Breakdown columns**: Overview *By-Rooftop-Type* & *By-CSM* tables and the Enterprise tab gained
  **Pub. On / Pub. Off** rooftop-count columns (self-activating — only appear once publishing-off rooftops
  exist). VIN Data tab gained a per-row **Publishing** column + filter. Materialized views `v_by_rooftop`
  / `v_by_enterprise` carry the publishing fields.

### C. Business exclusion (dashboard + emailers)
- Helper **`getExcludedVinsPredicate(alias)`** in app.js → `NOT (enterprise_id='f57d27acb' AND
  status_overall_status='FAILED')` (~92k rows). Applied to **all dashboard reads** (summary, VIN data,
  rooftop/enterprise CTE paths) + baked into both materialized views in db.js, **and now to the emailer
  compute queries** too.

### D. Customer emailers — publishing-aware ([server/emailTemplateDaily.js](server/emailTemplateDaily.js) + compute in app.js)
Both publishing-on and publishing-off entities still get daily emails; the variant differs:
- **Publishing-ON** → unchanged **Time to Market** report.
- **Publishing-OFF** →
  - TTM gauge replaced by a **Spyne Processing Time** gauge (hours, scale `0h/12h/24h/48h`,
    **<12h green / 12–24h amber / 24h+ red**, `gaugeImg(… max:48,t1:12,t2:24,dir:"desc")`).
  - **TTM glossary** entry dropped; the `†` Spyne Processing Time entry stays.
  - Group report: **TTM column dropped** from the *Inventory · Till Yesterday* by-location table.
  - **New & Used condition columns dropped** (collapses to the **NA** column) in BOTH the by-location table
    and the top Inventory KPI card.
  - PT gauge card is **vertically centered** (`kpiCard` `valign:"middle"`, since it has no sub-row).
- A `publishingOff` boolean is computed in `computeRooftopDailyReport` (rooftop's per-VIN `is_publishing`)
  and `computeGroupDailyReport` (**publishingOff = enterprise has ZERO publishing-on rooftops**) and threaded
  into `buildKpiCardsRow` / `buildGlossaryCard` / `buildByLocationTable`.
- **Mixed group rule**: a group with any publishing-on rooftop keeps the **TTM** report, but the **TTM metric
  is scoped to publishing-ON rooftops only** (`avg_ttl_days_inv` gauge + per-location `avg_ttl_days` get
  `AND COALESCE(v.is_publishing,1)=1`). Publishing-off rooftops then show **"—"** in the TTM column. Only the
  TTM metric is scoped — inventory counts, PT, scores, and the rooftop list still include all rooftops.

---

## 4. Locked decisions (from the user)

1. **Test isolation**: separate Supabase DB (not a `vins_test` table).
2. **Dashboard publishing dimension**: breakdown columns + a global On/Off/All header toggle (replaced the
   date filter). All data shown by default.
3. **Publishing signal**: per-VIN `COALESCE(is_publishing, 1)` is authoritative; **NULL → ON** (legacy/safe).
4. **Group emailer variant**: Spyne-PT variant **only if ALL the group's rooftops are publishing-off**; mixed
   groups keep TTM but scope the TTM calc to publishing-on rooftops.
5. **Spyne PT gauge bands**: `<12h` green / `12–24h` amber / `24h+` red.
6. **f57d27acb + FAILED exclusion** applies to dashboard **and** emailers.
7. **"Account type not partner"** = restrict to `enterprise_details.type ∈ {Group, Individual}` (exclude
   `Others`). NOTE: this was used **only to pick clean test examples** — it is **NOT** wired into the
   emailer/dashboard code. Decide if it should become a real filter.

---

## 5. Key files

- [server/app.js](server/app.js) — sync (`syncVins`, `VIN_COLUMNS`, `fetchFromMetabase`), helpers
  (`getPublishingCondition`, `getExcludedVinsPredicate`, `getDateCondition`), read paths (`computeSummary`,
  `buildRooftopSource`, `buildEnterpriseSource`, `buildVinFilters`, `/api/summary`), emailer compute
  (`computeRooftopDailyReport` ~1900, `computeGroupDailyReport` ~2237), preview endpoints, gauge.svg.
- [server/db.js](server/db.js) — `vins` schema + ALTERs + index; materialized views (publishing fields +
  the f57d27acb exclusion `WHERE`).
- [server/emailTemplateDaily.js](server/emailTemplateDaily.js) — `buildRooftopReportHtml`,
  `buildGroupReportHtml`, `buildKpiCardsRow` (gauge swap + valign), `buildGlossaryCard` (drop TTM),
  `buildByLocationTable` (drop TTM col + New/Used cols), `kpiCard`, `gaugeImg`.
- [inventory-dashboard.tsx](inventory-dashboard.tsx) — `pubScope` state/ref, header toggle, loaders/effects,
  Overview/Enterprise/VIN-Data publishing columns.
- `server/migrations/009_*.sql`, `server/migrations/010_*.sql`.
- `database_url.test.env` (gitignored) — test DB + `VIN_CARD_URL`.

---

## 6. Sample entities for testing (from the test DB; IDs are stable)

| Kind | ID | Note |
|---|---|---|
| Publishing-ON rooftop | `ad420d981` | TTM variant |
| Publishing-OFF rooftop | `008dcfccd5` | Spyne-PT variant |
| Pure-ON group | `10bb841f8` | TTM, control |
| Mixed group | `53362ce17` | TTM kept, scoped to pub-on |
| All-OFF group | `f57d27acb` | PT variant + this is the EXCLUDED enterprise |
| All-OFF group (Group, 17 rooftops, clean) | `c7c3a4999` | "Kolon Mobility Group" |
| All-OFF group (Group, 5 rooftops) | `f8c8d9175` | "Startin Group" |

Preview endpoints (recompute live from current code):
- Rooftop: `GET /api/preview-daily-report/raw?rooftopId=<id>[&date=YYYY-MM-DD]`
- Group:   `GET /api/preview-group-report/raw?enterpriseId=<id>[&date=YYYY-MM-DD]`
- (`/api/preview-daily-report?rooftopId=…` without `/raw` is just an iframe wrapper.)
- Default date = yesterday.

Grep markers used to verify HTML: gauge title `Time to Market` count (0 for publishing-off),
`max=48` (PT gauge present), `>TTM<` (by-location TTM column), `>New<`/`>Used<` (condition columns),
`kpi-cell" valign="middle"` (centered PT card).

---

## 7. NOT done / next steps

- **Prod cutover** — set `VIN_CARD_URL` to the new card in Vercel env (instant rollback = unset). UI breakdown
  columns are self-activating. **Watch the first prod sync** (3x volume; 180s CSV timeout w/ 1 retry; MV refresh;
  cache sizes; un-paginated exports).
- **Commit** — everything is uncommitted on `feat/vin-publishing-on-off`. (`gh` token was expired; user pushes
  via their own SSH key with a passphrase.)
- **Decide on the "account type ≠ partner / Others" filter** — currently test-only, not in code.
- Verify the **Spyne PT card title position** is acceptable — `valign:"middle"` centers the whole middle card
  (title + pill + gauge), so its title sits a bit lower than the Inventory/Photo titles. Switch to "title
  pinned top, gauge centered below" if the user dislikes it.
- The dashboard's earlier `vercel.json` cron edit (removed `/api/scheduled-report` triggers) is unrelated and
  was handled outside this branch.

---

## 8. Gotchas / lessons

- **db.js SQL lives inside JS template literals** — never put a backtick in the SQL (a `` `status` `` in a
  comment closed the template literal and broke the file). Use plain text / single quotes.
- **`summary_cache`** is populated at sync time. After changing summary logic, the Overview totals only update
  after a fresh sync (or clearing `summary_cache`). On/Off publishing summaries are computed fresh by design.
- A fresh test DB built via `initSchema` is **missing migration-only tables** (e.g. `daily_report_emails` from
  migration 008) — the rooftop/enterprise report joins need it. Run the relevant migration(s) against the test DB.
- `enterprise_details.type` values are only **Individual / Group / Others** (no "partner"). "Partner" lives in
  the source card's `customer_segment` (SMB/Ent/Mid/Resellers/…), which is **not synced**.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
