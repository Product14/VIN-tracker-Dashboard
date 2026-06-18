# VIN Tracker Dashboard — Project Handover

A complete reference for taking over ownership of the VIN Tracker Dashboard. Read top-to-bottom on day one; use as a lookup afterwards.

---

## 1. What this project does

The VIN Tracker Dashboard is a full-stack internal tool that monitors VIN (Vehicle Identification Number) inventory processing across all Spyne enterprise customers and their rooftops.

It does three things:

1. **Syncs data** from three Metabase cards (VINs, Rooftops, Enterprises) into a Postgres database on a schedule.
2. **Renders a dashboard** that lets internal users (CSMs, leadership) explore that inventory with rich filters, sorting, and CSV exports.
3. **Sends two kinds of automated email reports**:
   - A **global snapshot report** to the leadership distribution list three times a day.
   - **Per-rooftop and per-enterprise daily reports** to customers and their assigned CSMs once a day, processed via a queue.

Production URL: see `DASHBOARD_URL` in Vercel env vars.

---

## 2. Tech stack at a glance

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Frontend     | React 18 + Vite 6, single-file component (`inventory-dashboard.tsx`, ~2,725 lines) |
| Backend      | Express 5 on Node.js (ES Modules), single-file app (`server/app.js`, ~3,900 lines) |
| Database     | PostgreSQL on Supabase, transaction-mode pooler (port 6543)     |
| Hosting      | Vercel (static frontend + one serverless function at `api/index.js`) |
| Data source  | Metabase public card APIs (`metabase.spyne.ai`, no auth required) |
| Email        | Internal email API at `mail.spyne.ai` (HTML payloads)           |
| Scheduling   | Vercel Cron Jobs (six schedules, see §7)                        |
| Migrations   | Plain `.sql` files in `server/migrations/`, applied by `server/migrate.js` |

There is no ORM, no TypeScript on the backend, no test suite, and no separate package for the frontend. The entire codebase is intentionally small and concentrated in a handful of files.

---

## 3. High-level architecture

```
                Vercel Cron (6 schedules)
                       |
                       v
   +----------+   POST /api/sync          +----------------+
   | Metabase | ------------------------> | PostgreSQL     |
   | (3 cards)|   (also triggered by UI)  | (Supabase)     |
   +----------+                            +----------------+
                                                 ^   |
                                                 |   | queries
              +-----------------+----------------+   |
              |                 |                    v
              v                 v             +----------------+
  GET /api/scheduled-report     |             | GET /api/*     |
  (3x daily snapshot email)     |             | (summary,vins, |
              |                 v             |  rooftops,...) |
              |       GET /api/send-daily-report             |
              |       (1x daily, enqueues per-recipient rows)
              |                 |                    |
              |                 v                    v
              |    GET /api/process-report-queue   React Dashboard
              |    (every minute 12–13 UTC)        (browser)
              |                 |
              v                 v
        +------------+   +-----------------+
        | Internal   |   | Internal email  |
        | email API  |   | API (per-row)   |
        +------------+   +-----------------+
              |                 |
              v                 v
        Leadership list   Rooftop/Group recipients
```

Everything runs in one Vercel serverless function. The function imports the Express app from `server/app.js` and handles all `/api/*` routes; everything else is served as static files from `dist/`.

---

## 4. Data sources

Three Metabase public cards, fetched without authentication via the card UUIDs:

| Source             | Metabase Card ID                       | Used for                                                |
| ------------------ | -------------------------------------- | ------------------------------------------------------- |
| VIN Details        | `15e908e4-fe21-4982-9d8c-4aff07f2c948` (default; overridable via `VIN_CARD_URL` env) | All VIN inventory records (the critical dataset) |
| Rooftop Details    | `f5c032a6-c262-40ee-8d95-c115d326d3a8` | Rooftop metadata (name, type, score, integration flags) |
| Enterprise Details | `b8f1271c-cc5a-470f-badf-807711f74af4` | Enterprise metadata (name, type, POC/CSM email)         |

Card URLs are defined at [server/app.js:15](server/app.js#L15). The VIN card can be swapped without a code change by setting the `VIN_CARD_URL` env var — this is the intended mechanism for pointing at the expanded "publishing on + off" VIN card. There is no second hardcoded VIN UUID; old-vs-new is purely the env swap.

The sync fetches **CSV**, not JSON — the code rewrites the card's `/query/json` path to `/query/csv` ([server/app.js:149](server/app.js#L149)) and stream-parses the response.

The VIN card now also surfaces several columns beyond the basic inventory fields: `is_publishing`, `is_qc_on`, `platform`, `condition` (new/used), and `status_overall_status` (see §6).

The Metabase VIN query is slow. The VIN CSV fetch uses a 180-second timeout. Rooftops and Enterprises are fast (milliseconds) and non-critical (a failure on either is logged but does not abort the sync).

---

## 5. Sync flow (step by step)

A sync is triggered either by the UI ("Sync Now" button hitting `POST /api/sync`) or by the `GET /api/scheduled-report` cron.

1. The server acquires an **atomic sync lock** via the `sync_state` table (single row, primary key `id = 'global'`). If a sync is already running, the request returns `202 Already Running`.
2. The three Metabase cards are fetched sequentially: Rooftops, Enterprises, then VINs (VINs last because they're the critical, slow one).
3. **VINs are streamed, not buffered.** The CSV response is stream-parsed and flushed in chunks of 25,000 rows into a fresh `vins_staging` table (`CREATE TABLE vins_staging (LIKE vins INCLUDING DEFAULTS)`). Each chunk is inserted via an `UNNEST` array query, but only one chunk is resident in memory at a time — this bounds memory for the ~3x-larger publishing-on+off dataset. See [server/app.js:141](server/app.js#L141) onward. Rooftops and Enterprises (small) still use the simple replace-in-transaction approach.
4. **Atomic swap** ([server/app.js:307](server/app.js#L307)): in a single transaction, `TRUNCATE vins` then `INSERT INTO vins SELECT DISTINCT ON (dealer_vin_id) ... FROM vins_staging ORDER BY dealer_vin_id, ctid DESC` (last-streamed row wins on dedup). `TRUNCATE + INSERT` is used deliberately instead of `RENAME` so the `vins` table OID is preserved — the materialized views depend on it. (The old row-count truncation guard was removed in commit `727f5c4` because the source card's row count legitimately changed.)
5. After a successful VIN sync, post-processing runs:
   - **Summary cache** is recomputed for three **publishing-scope** variants (`all`, `on`, `off`) and stored in `summary_cache`. (This replaced the old date-filter variants — see note below.)
   - **Materialized views** `v_by_rooftop` and `v_by_enterprise` are refreshed concurrently (they are NOT dropped — see §6).
   - **Filter options cache** is recomputed and stored in `filter_cache` so dropdowns load instantly.
   - `sync_state.completed_at`, `total_rows`, and `last_sync` are updated.
6. The sync lock is released. If the VIN fetch failed, `completed_at` is intentionally NOT stamped — the UI then surfaces a stale-sync warning rather than a misleading "synced X min ago".

### The pendency threshold

Historically the SLA was "pending more than 24 hours." It is now **6 hours**. The column names in the database and API still say `after_24h` / `after24h` for backwards compatibility, but the logic in `pendencyPredicate6h()` (server/app.js:36) uses `INTERVAL '6 hours'`. The Metabase `after_24_hrs` field is stored but no longer authoritative — server-side queries recompute pendency from `received_at` / `processed_at`.

### Publishing scope (`all` / `on` / `off`)

The primary slice across the whole app is now **publishing scope**, driven by the VIN `is_publishing` flag (`COALESCE(is_publishing, 1)` — NULL is treated as publishing-ON):

- `on`  — publishing-on VINs only (`publishing=on` query param)
- `off` — publishing-off VINs only (`publishing=off`)
- `all` — no filter (param omitted; default)

The server condition helper is `getPublishingCondition` ([server/app.js:794](server/app.js#L794)). `summary_cache` is keyed by these three scope values. The dashboard exposes a global 3-way toggle (see §10).

> **Note on the dead date filter.** Historically the app sliced by a `post`/`pre`/`all` date filter with a **2026-04-01** cutoff. That machinery (`DATE_CUTOFF`, `getDateCondition`) still physically exists in [server/app.js:783](server/app.js#L783) and is still wired into the query builders, but **every caller now passes `dateFilter = null`, so it is dormant/dead code.** Confusingly, the `summary_cache` primary-key column is still literally named `date_filter` ([server/db.js:140](server/db.js#L140)) but now stores publishing-scope values (`all`/`on`/`off`). The column was never renamed — only its meaning changed (commit `b2687b4`).

---

## 6. Database schema

### Tables created in `server/db.js` (idempotent, run on every cold start)

| Table                          | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `vins`                         | Raw VIN inventory records; PK = `dealer_vin_id` (columns below)          |
| `vins_staging`                 | Transient table built during each sync; swapped into `vins` at the end (see §5) |
| `rooftop_details`              | Rooftop / dealership metadata; PK = `team_id`                            |
| `enterprise_details`           | Enterprise / organization metadata; PK = `enterprise_id`                 |
| `email_recipients`             | Email recipients for daily reports, mapped to a rooftop and/or enterprise with a `report_type` of `Rooftop` or `Group` |
| `sync_state`                   | Single-row distributed sync lock + last-sync metadata                    |
| `summary_cache`                | Precomputed summary JSON per date-filter variant                         |
| `filter_cache`                 | Precomputed filter dropdown options                                      |
| `daily_report_runs`            | Header row per daily-report run (run_id, started_at, recipient counts, test mode) |
| `report_queue`                 | One row per recipient per run; tracks status (`pending` → `processing` → `sent` / `skipped` / `error`), attempt count, error reason, TO/CC, entity, report_date |
| `rooftop_report_status_daily`  | Snapshot table written at the end of each run: `(report_day, rooftop_id) → status / reason`. Powers the Report Status tab. |

**`vins` columns** ([server/db.js:24](server/db.js#L24)): `dealer_vin_id` (PK), `vin`, `enterprise_id`, `rooftop_id`, `status`, `after_24h`, `received_at`, `processed_at`, `reason_bucket`, `hold_reason`, `has_photos`, `output_image_count`, `thumbnail_url`, `vdp_url`, `vehicle_price`, `condition` (new/used), `platform`, `is_publishing`, `is_qc_on`, `status_overall_status`, `synced_at`, plus ALTER-added `make`, `model`, `year`, `trim`, `stock_number`, `vin_score`, `vin_creation`. `is_publishing` / `is_qc_on` are SMALLINT; NULL `is_publishing` is treated as publishing-ON via `COALESCE(is_publishing, 1)`.

### Tables created via migrations

| Migration                                | Adds                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `001_add_enterprise_timezone.sql`        | `enterprise_details.timezone` column (used to pick "yesterday" per enterprise)  |
| `002_recipients_table.sql`               | Initial `email_recipients` schema                                               |
| `003_dealer_vin_id_nullable.sql`         | Allows null `dealer_vin_id` on `vins`                                           |
| `004_revert_pk_to_dealer_vin_id.sql`     | Reverts the VIN table primary key back to `dealer_vin_id`                       |
| `005_report_run_logs.sql`                | Adds `report_run_logs` (legacy; superseded by `report_queue`)                   |
| `006_add_report_queue.sql`               | Adds `report_queue`                                                             |
| `007_slim_daily_report_runs.sql`         | Slims down `daily_report_runs` columns                                          |
| `008_daily_report_emails.sql`            | Adds `daily_report_emails` (archive of sent HTML by entity + day)               |
| `009_add_vin_publishing_qc.sql`          | Adds `vins.is_publishing`, `vins.is_qc_on`, and a supporting index              |
| `010_add_vin_status_overall.sql`         | Adds `vins.status_overall_status`                                               |

There is also a `schema_migrations` tracking table that records which `.sql` files have been applied.

### Materialized views

- `v_by_rooftop` — aggregated stats per rooftop (joins `vins` + `rooftop_details` + `enterprise_details`)
- `v_by_enterprise` — aggregated stats per enterprise

Both have unique indexes (`uix_mv_rooftop_id`, `uix_mv_enterprise_id`) so they can be refreshed with `REFRESH MATERIALIZED VIEW CONCURRENTLY`, which doesn't block readers.

**They are created `IF NOT EXISTS` and left in place — NOT dropped on cold start** (changed in commit `ccbc6fb` to fix a refresh race; [server/db.js:233](server/db.js#L233)). The earlier behavior of dropping + recreating them on every cold start caused races and unnecessary full rebuilds. **Consequence:** if you change a materialized-view *definition*, the new SQL will not take effect automatically — you must drop the view via an explicit migration so the `IF NOT EXISTS` recreate picks up the new shape. (The `DROP VIEW IF EXISTS` calls in db.js are legacy regular-view cleanup and do not touch the materialized views.)

### Indexes on `vins`

`idx_vins_rooftop_id`, `idx_vins_enterprise_id`, `idx_vins_status`, `idx_vins_received_at`, `idx_vins_has_photos`, `idx_vins_reason_bucket`, `idx_vins_status_photos_24h` (composite for the common combined filter).

---

## 7. Cron jobs (Vercel)

Configured in [vercel.json](vercel.json). Times are UTC.

| Cron expression  | UTC          | IST              | Endpoint                       | Purpose                                                      |
| ---------------- | ------------ | ---------------- | ------------------------------ | ------------------------------------------------------------ |
| `30 6 * * *`     | 06:30        | 12:00 PM         | `/api/scheduled-report`        | Snapshot email #1 (sync + summary email to leadership list)  |
| `30 12 * * *`    | 12:30        | 6:00 PM          | `/api/scheduled-report`        | Snapshot email #2                                            |
| `30 18 * * *`    | 18:30        | 12:00 AM         | `/api/scheduled-report`        | Snapshot email #3                                            |
| `0 12 * * *`     | 12:00        | 5:30 PM          | `/api/send-daily-report`       | Enqueues per-recipient daily reports for rooftops + groups   |
| `* 12-13 * * *`  | every minute 12:00–13:59 | 5:30–7:29 PM | `/api/process-report-queue`    | Drains the `report_queue` and sends individual emails        |
| `0 3 * * *`      | 03:00        | 8:30 AM          | `/api/cleanup-report-archive`  | Prunes old rows from `daily_report_emails`                   |

All cron endpoints require a `Bearer` token matching `CRON_SECRET` (auto-provided by Vercel).

---

## 8. The two reporting pipelines

### Pipeline A — Snapshot report (3x daily)

- Endpoint: `GET /api/scheduled-report`
- Triggered: 3 times a day by cron
- Behavior:
  1. Triggers a full Metabase → DB sync.
  2. Computes a fresh summary directly from the DB (never from cache, so the `lastSync` timestamp is accurate).
  3. Builds an HTML email via `buildEmailHtml()` in [server/emailTemplate.js](server/emailTemplate.js): KPI row + reason-bucket badges + by-rooftop-type table + by-CSM table + CTA button.
  4. Sends to `EMAIL_TO` / `EMAIL_CC` / `EMAIL_BCC` (env-configured leadership list).
- Subject: `Studio Control Tower Report - {date} {time}`, e.g. `Studio Control Tower Report - 16 Apr 2026 12 PM`.
- Failure mode: if sync fails, the email still goes out using the last cached summary; the error is logged. If summary computation fails, the endpoint returns 500 and no email is sent.

### Pipeline B — Daily per-recipient reports (queued)

A more elaborate pipeline that sends one report per rooftop and one per enterprise group, only to that entity's assigned recipients.

1. **Enqueue** — `GET /api/send-daily-report` runs once a day (cron at 12:00 UTC). It joins `email_recipients` with `rooftop_details` / `enterprise_details` and inserts one row per recipient into `report_queue` with status `pending`. The `report_date` is calculated as "end-of-yesterday in the entity's timezone" (using `enterprise_details.timezone` from migration 001), stored as a UTC timestamp.
2. **Drain** — `GET|POST /api/process-report-queue` runs every minute between 12:00 and 13:59 UTC. It claims `pending` rows in small batches, generates HTML (rooftop template or group template from [server/emailTemplateDaily.js](server/emailTemplateDaily.js), ~1,000 lines, includes inline donut chart SVGs), sends via the internal email API, and updates row status to `sent` / `skipped` / `error` with reason and attempt count.
3. **Archive** — successful sends are written into `daily_report_emails` with the rendered HTML for later audit/replay.
4. **Status snapshot** — at the end of the run, `rooftop_report_status_daily` is populated so the dashboard's Report Status tab and the per-rooftop / per-enterprise 7-day history columns can render without joining the queue table.
5. **Cleanup** — `GET /api/cleanup-report-archive` daily at 03:00 UTC removes old archived emails.

The templates use:
- `GET /api/donut.svg` — generates donut chart SVGs (color, total, labels via query params)
- `GET /api/split-dot.svg` — additional chart type

Previewing locally: `GET /api/preview-daily-report?rooftopId=...` and `?enterpriseId=...` render the same HTML the email would contain.

---

## 9. API endpoints (complete list)

### Data
| Method | Path                                              | Purpose                                                              |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/summary`                                    | KPI overview + by-CSM + by-type stats (served from `summary_cache`)  |
| GET    | `/api/vins`                                       | Paginated VIN records with filters and joins                         |
| GET    | `/api/vins/raw`                                   | Raw VIN passthrough (debug / admin)                                  |
| GET    | `/api/rooftops`                                   | Aggregated rooftop stats + 7-day report history                      |
| GET    | `/api/rooftops/:rooftopId/report-history`         | Detailed 7-day report history for one rooftop                        |
| GET    | `/api/enterprises`                                | Aggregated enterprise stats + group report status + history          |
| GET    | `/api/filter-options`                             | Dropdown choices (served from `filter_cache`)                        |

### Export
| Method | Path                          |
| ------ | ----------------------------- |
| GET    | `/api/vins/export`            |
| GET    | `/api/rooftops/export`        |
| GET    | `/api/enterprises/export`     |

### Sync
| Method | Path                  | Purpose                                          |
| ------ | --------------------- | ------------------------------------------------ |
| POST   | `/api/sync`           | Manual sync trigger (UI button)                  |
| GET    | `/api/sync/status`    | Current sync state (running, startedAt, lastSync) |

### Reporting (cron + admin)
| Method        | Path                                      | Purpose                                          |
| ------------- | ----------------------------------------- | ------------------------------------------------ |
| GET           | `/api/scheduled-report`                   | Pipeline A: snapshot sync + email                |
| GET           | `/api/send-daily-report`                  | Pipeline B step 1: enqueue daily reports         |
| GET           | `/api/send-daily-report/status`           | Status of the most recent daily run              |
| GET / POST    | `/api/process-report-queue`               | Pipeline B step 2: drain queue                   |
| GET           | `/api/cleanup-report-archive`             | Pipeline B step 4: prune old archived emails     |
| GET           | `/api/report-coverage`                    | Per-entity send/skip/error counts                |
| GET           | `/api/preview-daily-report`               | Render an email HTML for a given rooftop/enterprise (preview UI) |
| GET           | `/api/preview-daily-report/raw`           | Same but returns the underlying data, not the rendered HTML |
| GET           | `/api/rooftop-report`                     | Single rooftop report data (used by preview)     |
| GET           | `/api/rooftop-report/raw`                 | Raw data variant                                 |
| GET           | `/api/enterprise-report`                  | Single enterprise group report data              |
| GET           | `/api/enterprise-report/raw`              | Raw data variant                                 |
| POST          | `/api/admin/backfill-report-status`       | Backfills `rooftop_report_status_daily` from existing queue/archive history (runs `server/backfill-report-status.js`) |

### Recipients
| Method | Path                                  | Purpose                                                   |
| ------ | ------------------------------------- | --------------------------------------------------------- |
| GET    | `/api/email-recipients`               | List configured recipients                                |
| POST   | `/api/email-recipients` (upload form) | Bulk upload / update recipients (used by the dashboard UI) |

### Graphics (used inside email HTML)
| Method | Path                  |
| ------ | --------------------- |
| GET    | `/api/donut.svg`      |
| GET    | `/api/split-dot.svg`  |

### Common query parameters

Most data endpoints accept:
- `page`, `pageSize` — pagination (10–500, default 50)
- `sortBy`, `sortDir` — column sorting (column names are whitelisted to prevent SQL injection)
- `search` — free-text across VIN, rooftop, CSM, enterprise
- `publishing` — `on` / `off` / omit for all (the primary scope slice; see §5)
- `enterpriseId`, `rooftopId`, `csm`, `status`, `rooftopType`, `after24h`, `hasPhotos`, `reasonBucket` — exact-match filters
- `dateFilter` — **dormant**: still accepted (`post` / `pre`) but no caller sets it; see the note in §5

---

## 10. Frontend

The entire frontend lives in [inventory-dashboard.tsx](inventory-dashboard.tsx) (~2,725 lines) and mounts from [src/main.jsx](src/main.jsx).

**Five tabs**, defined at [inventory-dashboard.tsx:2295](inventory-dashboard.tsx#L2295):

1. **Overview** — KPI cards (Total, With Photos, Delivered, Pending, Pending >6h, reason buckets) + By Rooftop Type table + By CSM table. KPI cards are clickable for drill-down.
2. **Enterprise View** — paginated, sortable, server-filtered enterprise table. Includes the **7-day group report history column** (recent feature; shows status badges for each of the last 7 days, linking to archived HTML).
3. **Rooftop View** — paginated, sortable rooftop table with 7-day report history column and per-rooftop drill-down to historical reports.
4. **VIN Data** — paginated, sortable VIN-level table with rich filters and configurable page sizes (50/100/200/500).
5. **Report Status** — coverage heatmap built from `/api/report-coverage`; shows which rooftops/enterprises did or didn't get reports each day and why.

Common behavior across tabs:
- Pagination, sorting, and filtering are all **server-side** (not client-side).
- The header shows last sync time and a "Sync Now" button (calls `POST /api/sync`).
- CSV exports come from the `/api/*/export` endpoints (no pagination), generated client-side.
- **Global publishing-scope toggle** — a 3-way segmented control ("All / Publishing On / Publishing Off") in the header, state `pubScope`, persisted to `localStorage["vin_pubScope"]`. When not "All" it is appended as `&publishing=<on|off>` to every data fetch and passed into the VIN / Rooftop / Enterprise tabs. (The VIN tab also has its own per-tab publishing dropdown, and the Enterprise tab has dedicated Pub-On/Pub-Off columns with drill-down.)

---

## 11. Environment variables

| Variable                    | Required | Purpose                                                                |
| --------------------------- | -------- | ---------------------------------------------------------------------- |
| `VIN_TRACKER_DATABASE_URL`  | Yes      | Supabase Postgres connection string (transaction mode, port 6543)      |
| `VIN_CARD_URL`              | No       | Overrides the default VIN Metabase card UUID (used to swap to the publishing on+off card) |
| `INTERNAL_EMAIL_API_URL`    | Yes (prod) | Internal email API endpoint, typically `https://mail.spyne.ai/api/v1/send-template-email` |
| `EMAIL_TO`                  | Yes (prod) | Snapshot report primary recipients (comma-separated)                   |
| `EMAIL_CC`                  | No       | Snapshot report CC                                                     |
| `EMAIL_BCC`                 | No       | Snapshot report BCC                                                    |
| `FROM`                      | No       | "From" address override for the internal email API                     |
| `DASHBOARD_URL`             | Yes (prod) | Used in the CTA button inside emails                                 |
| `PUBLIC_BASE_URL`           | No       | Fallback if `DASHBOARD_URL` not set; used by email templates           |
| `VERCEL_URL`                | Auto     | Vercel-injected; used as last-resort fallback for base URL             |
| `CRON_SECRET`               | Auto     | Vercel-injected; cron endpoints reject requests without it             |
| `PORT`                      | No       | Local dev only; defaults to 3002                                       |

For local development, `database_url.env` is read via `node --env-file=database_url.env`. Don't commit it.

---

## 12. Migration system

Migrations are plain `.sql` files in [server/migrations/](server/migrations/), applied by [server/migrate.js](server/migrate.js).

When migrations run:
- Locally: `npm run server` runs `node server/migrate.js` first, then starts the API server.
- In production: `vercel.json`'s `buildCommand` is `node server/migrate.js && npm run build`, so migrations are applied at deploy time before the build.

Each migration file is recorded in a `schema_migrations` tracking table to avoid re-application.

Migrations currently run `001`–`010`. To add a new one, drop a new `NNN_description.sql` file in `server/migrations/` using the next sequence number. Keep statements idempotent (`IF NOT EXISTS`, `IF EXISTS`) wherever possible — `server/db.js` reapplies the base schema on every cold start, and your migration may interact with that.

---

## 13. Local development

### Prerequisites
- Node.js 18+ (ES modules)
- A Postgres database (Supabase or local)
- npm

### Setup
1. `npm install`
2. Create `database_url.env` in the project root:
   ```env
   VIN_TRACKER_DATABASE_URL=postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   In Supabase: project → **Connect** → copy the **Transaction mode** string (port 6543).
3. Optional, for testing email flows locally:
   ```env
   INTERNAL_EMAIL_API_URL=https://mail.spyne.ai/api/v1/send-template-email
   EMAIL_TO=your-email@spyne.ai
   DASHBOARD_URL=http://localhost:5173/
   ```
4. `npm start` — runs Vite (frontend on `:5173`) and the Express server (`:3002`) concurrently. Vite proxies `/api/*` to `:3002` and `/metabase-api/*` to `metabase.spyne.ai`.
5. Open `http://localhost:5173`, click **Sync Now** (or `curl -X POST http://localhost:3002/api/sync`). The first sync takes 1–2 minutes.

### Useful npm scripts
| Script             | Does                                                          |
| ------------------ | ------------------------------------------------------------- |
| `npm run dev`      | Vite frontend only                                            |
| `npm run server`   | Runs migrations, then starts the Express API                  |
| `npm run migrate`  | Runs migrations once and exits                                |
| `npm start`        | Both `dev` and `server` concurrently                          |
| `npm run build`    | Builds the frontend to `dist/`                                |
| `npm run preview`  | Serves the built frontend                                     |

---

## 14. Deployment (Vercel)

### How the serverless function works

[api/index.js](api/index.js) is the single Vercel function entry point. It imports the Express app from [server/app.js](server/app.js), calls `initSchema()` on cold start, and handles every `/api/*` route. The connection pool is kept minimal (`max: 1`) because the function is stateless and short-lived.

Table and materialized-view creation is idempotent (`IF NOT EXISTS`). **Materialized views are no longer dropped on cold start** (see §6) — they persist, so a view *definition* change requires an explicit drop migration.

The function has `maxDuration: 600` (10 minutes) and `memory: 3008` (MB) in `vercel.json` — the memory was raised to handle the ~3x-larger publishing on+off VIN volume during sync.

### Required env vars in Vercel

Set under Project Settings → Environment Variables:
- `VIN_TRACKER_DATABASE_URL`
- `INTERNAL_EMAIL_API_URL`
- `EMAIL_TO`, `EMAIL_CC`, `EMAIL_BCC`
- `FROM` (if you want a custom From address)
- `DASHBOARD_URL`

`CRON_SECRET` is auto-provided by Vercel and consumed by every cron endpoint.

### Deploy flow

`git push` to `main` → Vercel runs `node server/migrate.js && npm run build` → deploys static assets to CDN + the serverless function. The schema is also re-initialized on the next cold start regardless.

---

## 15. Access & credentials checklist (for handover)

The incoming maintainer needs access to:

- [ ] **GitHub repo** — push/admin access on the repository
- [ ] **Vercel project** — admin (to read logs, manage env vars, redeploy, edit crons)
- [ ] **Supabase project** — admin or developer (to run SQL, inspect tables, rotate the DB password)
- [ ] **Metabase** — view-only is enough for the three source cards; ownership of the cards if they need editing
- [ ] **Internal email API** — credentials / allowlist if any IP-based restriction exists on `mail.spyne.ai`
- [ ] **Distribution list** — knowledge of who is on `EMAIL_TO` for the snapshot report and a process for updating it
- [ ] **`email_recipients` table** — understanding of how rooftop and group recipients are managed (CSV upload via the dashboard or direct SQL)
- [ ] **Production `DASHBOARD_URL`** — the customer-facing URL for the CTA buttons

Rotate the following on handover:
- Supabase DB password (and update `VIN_TRACKER_DATABASE_URL` in Vercel)
- Any shared internal email API token

---

## 16. Operations runbook

### Check whether the last sync succeeded
```
GET /api/sync/status
```
If `completedAt` is recent, you're fine. If `running: true` for >10 minutes, the sync is stuck (see below).

### Manually trigger a sync
```
curl -X POST https://[dashboard-url]/api/sync
```
Or click **Sync Now** in the dashboard header.

### Sync stuck in "running" state
A serverless timeout mid-sync can leave `sync_state.running` stuck at `TRUE`. Clear it via SQL:
```sql
UPDATE sync_state SET running = FALSE WHERE id = 'global';
```

### Snapshot email didn't go out
1. Check Vercel function logs for the run that should have happened at 06:30 / 12:30 / 18:30 UTC.
2. Search for the `[email]` prefix in logs.
3. Common causes: `INTERNAL_EMAIL_API_URL` or `EMAIL_TO` missing in env, internal email API rejecting the payload, sync failed and there was no cached summary to fall back to.

### Daily per-recipient reports look incomplete
1. Hit `GET /api/send-daily-report/status` to see the latest run's recipient/sent/error counts.
2. Hit `GET /api/report-coverage` to see per-entity status.
3. Inspect `report_queue` directly:
   ```sql
   SELECT status, COUNT(*) FROM report_queue
   WHERE report_date >= NOW() - INTERVAL '2 days'
   GROUP BY status;
   ```
4. Errors with reasons land in `report_queue.error_reason`.

### Replay a single rooftop's report manually
- Preview HTML: `GET /api/preview-daily-report?rooftopId=...`
- Look up archived HTML: `SELECT * FROM daily_report_emails WHERE rooftop_id = '...' ORDER BY report_day DESC LIMIT 7;`

### Backfill the Report Status snapshot
If `rooftop_report_status_daily` is out of sync with `report_queue` (e.g. after restoring data), run:
```
POST /api/admin/backfill-report-status
```
which executes [server/backfill-report-status.js](server/backfill-report-status.js).

### Add or remove email recipients
- Snapshot report (Pipeline A): update `EMAIL_TO` / `EMAIL_CC` / `EMAIL_BCC` in Vercel, then redeploy (or trigger a new deployment so env vars take effect).
- Daily reports (Pipeline B): update the `email_recipients` table — either via the recipient management UI in the dashboard or via direct SQL.

### Dashboard showing stale data
The dashboard reads from `summary_cache` and `filter_cache`. These are updated only at the end of a successful sync. If the last sync failed (VINs critical failure), the caches will be stale. Check `/api/sync/status` and re-trigger.

### Cold-start latency
The first request after a deploy or period of inactivity is 2–5 seconds because the serverless function initializes the DB schema and recreates materialized views. Subsequent requests on the warm instance are <50 ms for cached endpoints.

---

## 17. Known gotchas

- **`after_24h` doesn't mean 24 hours anymore** — the threshold is 6 hours. The column name and query parameter were kept for backwards compatibility. Don't rely on the name.
- **Metabase VIN queries are slow** — tens of seconds, now larger with the publishing on+off card. The VIN CSV fetch uses a 180-second timeout. If you see repeated timeouts in production, the Metabase card query likely needs optimization (talk to whoever owns the Metabase card).
- **The sync lock is global** — only one sync can run across all serverless instances. A second concurrent trigger returns `202 Already Running` instead of failing.
- **`completed_at` is intentionally not stamped on failed VIN syncs** — this is so the UI doesn't show a misleading "synced X min ago" message. If you see `completedAt` lagging behind `startedAt`, the last sync's VIN step failed.
- **Materialized views are NOT dropped on cold start (anymore)** — they're created `IF NOT EXISTS` and persist (commit `ccbc6fb`, fixing a refresh race). This means a change to a view *definition* will silently not take effect — you must drop the view in an explicit migration. (The handover previously documented the opposite, drop-on-cold-start behavior; that is no longer true.)
- **`summary_cache.date_filter` no longer means a date** — the column was never renamed but now stores publishing scope (`all`/`on`/`off`). And `dateFilter` (`post`/`pre`, 2026-04-01 cutoff) is dormant dead code: the helpers still exist but no caller sets it.
- **No FAILED-VIN business exclusion** — the old logic that hid a specific enterprise's `FAILED` VINs from dashboard queries was removed (commit `d53c4e0`). `status_overall_status` is still ingested but nothing filters on it.
- **VIN sync uses a staging-table swap** — `vins_staging` is built chunk-by-chunk then swapped into `vins` via `TRUNCATE + INSERT` (not `RENAME`, to preserve the table OID the MVs depend on). If a sync dies mid-stream, a stale `vins_staging` may be left behind; it's recreated (`LIKE vins`) at the start of the next sync, so it's self-healing, but worth knowing.
- **The row-count truncation guard is gone** — syncs no longer abort if the new row count differs sharply from the old one (commit `727f5c4`); the publishing on+off card legitimately changed volume. A genuinely broken/empty source card will now replace `vins` with whatever it returns.
- **`vercel.json`'s `* 12-13 * * *` cron** — runs every minute for two hours daily. If you ever shorten the report-generation window, make sure all queued recipients can be drained within it; otherwise some emails will be left as `pending` indefinitely.
- **CSV recipient uploads are write-mostly** — the UI replaces the recipient set per entity rather than appending. Double-check before uploading.
- **Inline SVG charts in emails** — Gmail and Outlook web render them fine; some older clients may not. If a recipient complains about missing charts, the template is in [server/emailTemplateDaily.js](server/emailTemplateDaily.js) and graphics come from `/api/donut.svg` and `/api/split-dot.svg`.
- **No tests** — there is no automated test suite. Verification is manual: trigger a sync, open the dashboard, hit `/api/preview-daily-report`, eyeball the HTML.

---

## 18. File structure

```
VIN-tracker-Dashboard/
├── api/
│   └── index.js                  # Vercel serverless entry; imports Express app
├── server/
│   ├── app.js                    # ~3,900 lines — Express app: routes, sync, queries, queue
│   ├── db.js                     # Postgres pool, schema init, materialized views
│   ├── emailClient.js            # Sender for the internal email API
│   ├── emailTemplate.js          # Snapshot report HTML (Pipeline A)
│   ├── emailTemplateDaily.js     # ~1,000 lines — rooftop + group report HTML (Pipeline B)
│   ├── index.js                  # Local dev entry (PORT 3002)
│   ├── migrate.js                # Applies .sql migrations
│   ├── migrations/               # Numbered .sql migration files (001–010)
│   ├── backfill-report-status.js # One-shot rebuild of rooftop_report_status_daily
│   ├── scoreUtil.js              # Helper: website-score → label
│   └── spyneLogo.js              # Inline base64 logo for emails
├── src/
│   └── main.jsx                  # React app entry point
├── inventory-dashboard.tsx       # ~2,725 lines — entire dashboard UI
├── index.html                    # Vite root document
├── preview.html                  # Standalone email-preview HTML
├── vercel.json                   # Build command, rewrites, function settings, crons
├── vite.config.js                # Vite + dev proxy
├── package.json                  # Dependencies and npm scripts
├── database_url.env              # Local DB credentials (gitignored)
└── readme.md                     # Original technical readme (kept for reference)
```

---

## 19. Where to look first when something breaks

| Symptom                                              | First file to open                                              |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| API endpoint returning wrong data                    | [server/app.js](server/app.js) (search by path)                |
| Sync not happening                                   | `POST /api/sync` handler in [server/app.js:904](server/app.js#L904) |
| Snapshot email looks wrong                           | [server/emailTemplate.js](server/emailTemplate.js)              |
| Daily rooftop/group email looks wrong                | [server/emailTemplateDaily.js](server/emailTemplateDaily.js)    |
| Email not being sent                                 | [server/emailClient.js](server/emailClient.js)                  |
| Queue stuck                                          | `report_queue` table + `/api/process-report-queue` handler      |
| Dashboard UI bug                                     | [inventory-dashboard.tsx](inventory-dashboard.tsx) (single file) |
| Cron not firing                                      | [vercel.json](vercel.json) + Vercel dashboard → Cron Jobs       |
| Schema-related error                                 | [server/db.js](server/db.js) + [server/migrations/](server/migrations/) |

---

*End of handover. Keep this document in sync with the codebase — when something material changes (new cron, new table, threshold change, new tab), update the relevant section here so the next handover is easier.*
