# VIN Tracker Dashboard

A full-stack inventory tracking dashboard that monitors VIN (Vehicle Identification Number) processing across enterprises and rooftops. It pulls data from Metabase, stores it in PostgreSQL, serves it through a React UI with rich filtering and sorting, and sends automated email reports three times a day.

---

## Tech Stack

| Layer      | Technology                                                         |
| ---------- | ------------------------------------------------------------------ |
| Frontend   | React 18, Vite 6, JSX (single-component SPA)                      |
| Backend    | Express 5, Node.js (ES Modules)                                    |
| Database   | PostgreSQL on Supabase (transaction-mode pooler, port 6543)        |
| Hosting    | Vercel (static frontend + serverless API function)                 |
| Data Source| Metabase public card APIs (`metabase.spyne.ai`)                    |
| Email      | Internal email API (`mail.spyne.ai`) with HTML template            |
| Scheduling | Vercel Cron Jobs (3 daily triggers)                                |

---

## Architecture & Data Flow

```
                        Vercel Cron (3x daily)
                              |
                              v
  +------------+      +-------------+      +------------------+
  |  Metabase  | ---> |  POST       | ---> |  PostgreSQL      |
  |  (3 public |      |  /api/sync  |      |  (Supabase)      |
  |   cards)   |      +-------------+      +------------------+
  +------------+            |                    |
                            |                    | queries
                            v                    v
                     +-------------+      +------------------+
                     | Email API   |      | GET /api/*       |
                     | (HTML       |      | (summary, vins,  |
                     |  report)    |      |  rooftops, etc.) |
                     +-------------+      +------------------+
                            |                    |
                            v                    v
                     +-------------+      +------------------+
                     | Recipients  |      | React Dashboard  |
                     | (inbox)     |      | (browser)        |
                     +-------------+      +------------------+
```

### How the data sync works (step by step)

1. A sync is triggered either by the Vercel Cron schedule (via `GET /api/scheduled-report`) or manually (via `POST /api/sync` from the dashboard UI).

2. The server acquires an **atomic sync lock** in the `sync_state` table. Only one sync can run at a time across all serverless instances. If a sync is already running, the request gets a `202 Already Running` response.

3. Three data sources are fetched sequentially from Metabase's public card API (no auth required):
   - **Rooftops** and **Enterprises** sync first. These are fast (milliseconds) and non-critical. If either fails, the error is logged and execution continues.
   - **VINs** syncs last. This is the critical dataset. It gets 1 retry with a 65-second timeout per attempt (Metabase VIN queries can take ~60 seconds). If VINs fail, the entire sync is marked as failed.

4. Each dataset goes through **deduplication** (group by primary key, keep latest record), then gets bulk-inserted using PostgreSQL `UNNEST` arrays in a single query. The table is fully replaced each time (DELETE + INSERT inside a transaction).

5. After a successful VIN sync, the server runs post-processing:
   - Precomputes **3 summary variants** (`all`, `post`, `pre` date filters) and stores them in `summary_cache`.
   - Refreshes **materialized views** (`v_by_rooftop`, `v_by_enterprise`) concurrently (non-blocking reads).
   - Precomputes the **filter options** cache so the dashboard filter dropdowns load instantly.
   - Updates `sync_state` with total row count and last sync timestamp.

6. The sync lock is released. If VINs failed, `completed_at` is NOT stamped so the UI doesn't show a misleading "synced X min ago" message.

### Data sources (Metabase cards)

| Source               | Metabase Card ID                           | Key Fields                                                                                              |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| VIN Details          | `15e908e4-fe21-4982-9d8c-4aff07f2c948`     | vinName, dealerVinId, enterpriseId, teamId, status, after_24_hrs, receivedAt, sentAt, reason_bucket, has_photos |
| Rooftop Details      | `f5c032a6-c262-40ee-8d95-c115d326d3a8`     | team_id, enterprise_id, team_name, team_type, overallScore, ims_integration_status, publishing_status    |
| Enterprise Details   | `b8f1271c-cc5a-470f-badf-807711f74af4`     | enterprise_id, name, type, website_url, email_id (POC/CSM email)                                        |

### Date filter logic

A cutoff date of **2026-04-01** is used to split data into two segments:
- `post` = VINs received on or after April 1, 2026
- `pre` = VINs received before April 1, 2026 (or with no received date)
- `all` = No date filtering

This filter applies to the summary, rooftops, and enterprises APIs. When a date filter is active, the server uses inline CTEs instead of materialized views so the filter is applied before aggregation.

---

## Dashboard Features

The frontend is a single React component (`inventory-dashboard.tsx`) that renders four tabs:

### Overview Tab
- **KPI Cards** at the top showing: Total Inventory, With Photos, Delivered, Pending, Pending >24hr, and reason bucket breakdowns.
- **By Rooftop Type** table grouping stats by Franchise Group, Franchise Individual, Independent Group, Independent Individual, and Others.
- **By CSM** table grouping the same stats by the CSM (Customer Success Manager) email associated with each enterprise.

### Rooftops Tab
- Paginated, sortable table of all rooftops with columns for: name, type, enterprise, CSM, inventory counts, delivery metrics, website score, IMS integration status, and publishing status.
- Filters: search, enterprise, type, CSM, IMS integration, publishing status, website score range.
- CSV export of the filtered dataset.

### Enterprises Tab
- Paginated, sortable table of all enterprises with columns for: name, CSM, inventory counts, delivery metrics, rooftop count, integration/publishing counts, average website score.
- Filters: search, CSM, account type, website score range.
- CSV export of the filtered dataset.

### Raw VIN Data Tab
- Paginated, sortable table of every individual VIN record.
- Filters: search (VIN/rooftop/CSM/enterprise), enterprise, rooftop, type, CSM, status, after 24h, has photos, reason bucket, date filter.
- Configurable page sizes (50, 100, 200, 500).
- CSV export of the filtered dataset.

### Common UI features
- All tabs support **server-side pagination, sorting, and filtering** (not client-side).
- The dashboard header shows the last sync time and a manual "Sync Now" button.
- Stat cards are clickable to drill into the filtered view.
- CSV exports are generated client-side from the export API endpoints (which return all matching rows without pagination).

---

## Email Alerts

### Schedule

The dashboard sends automated email reports **three times a day** via Vercel Cron:

| Cron Expression  | UTC Time   | IST Time        |
| ---------------- | ---------- | --------------- |
| `30 6 * * *`     | 06:30 UTC  | 12:00 PM IST   |
| `30 12 * * *`    | 12:30 UTC  | 6:00 PM IST    |
| `30 18 * * *`    | 18:30 UTC  | 12:00 AM IST   |

### How the email report works

1. Vercel Cron sends a `GET` request to `/api/scheduled-report` with a `Bearer` token (`CRON_SECRET`).
2. The endpoint first triggers a full data sync from Metabase (same as manual sync).
3. It then computes a fresh summary directly from the database (never from cache, so the lastSync timestamp is accurate).
4. The summary data is passed to `buildEmailHtml()` which generates a self-contained HTML email containing:
   - **Header**: "VIN Tracker - Dashboard Snapshot" with date, time, and last sync timestamp.
   - **KPI row**: Total Inventory, With Photos, VIN Delivered, Pending VINs, Pending >24hr.
   - **Pending Reason Buckets**: Color-coded badges for Processing Pending, Publishing Pending, QC Pending, QC Hold, Sold, Others.
   - **By Rooftop Type table**: Enterprises, Rooftops, Inventory, With Photos, Delivered, Pending, Pending >24hr, Pending >24hr %, Avg Score.
   - **By CSM table**: Same columns, grouped by CSM (email stripped to display name).
   - **CTA button**: "View Full Dashboard" linking to the production URL.
5. The HTML is sent via `POST` to the internal email API (`INTERNAL_EMAIL_API_URL`).

### Email recipients

Configured via environment variables:

| Env Var    | Description                              | Required |
| ---------- | ---------------------------------------- | -------- |
| `EMAIL_TO` | Primary recipient(s), comma-separated    | Yes      |
| `EMAIL_CC` | CC recipients, comma-separated           | No       |
| `EMAIL_BCC`| BCC recipients, comma-separated          | No       |

### Email subject format

`Studio Control Tower Report - {date} {time}`

Example: `Studio Control Tower Report - 16 Apr 2026 12 PM`

### Failure handling

- If the sync fails (VINs critical failure), the email is still sent using the last available cached summary data. Recipients still get a report, and the error is logged server-side.
- If the sync is already running (concurrent cron trigger), the email proceeds with cached data and logs a warning.
- If summary computation fails, the endpoint returns HTTP 500 and no email is sent.

---

## API Endpoints Reference

### Data Endpoints

| Method | Path                    | Description                                        | Pagination |
| ------ | ----------------------- | -------------------------------------------------- | ---------- |
| GET    | `/api/summary`          | Dashboard overview (totals, by CSM, by type, buckets). Served from precomputed cache. | No |
| GET    | `/api/vins`             | Paginated VIN records with joins to rooftop/enterprise. | Yes (page, pageSize) |
| GET    | `/api/rooftops`         | Aggregated rooftop stats from materialized view or CTE. | Yes |
| GET    | `/api/enterprises`      | Aggregated enterprise stats from materialized view or CTE. | Yes |
| GET    | `/api/filter-options`   | Available values for all filter dropdowns. Served from cache. | No |

### Export Endpoints

| Method | Path                       | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| GET    | `/api/vins/export`         | All matching VINs (no pagination)      |
| GET    | `/api/rooftops/export`     | All matching rooftops (no pagination)  |
| GET    | `/api/enterprises/export`  | All matching enterprises (no pagination)|

### Sync & Reporting Endpoints

| Method | Path                      | Description                                                        |
| ------ | ------------------------- | ------------------------------------------------------------------ |
| POST   | `/api/sync`               | Triggers a full data sync. Waits for completion. Returns 202 if already running. |
| GET    | `/api/sync/status`        | Returns current sync state (running, startedAt, completedAt, totalRows, lastSync). |
| GET    | `/api/scheduled-report`   | Cron endpoint: syncs data, computes summary, sends email. Requires `CRON_SECRET`. |

### Common Query Parameters

Most data endpoints accept these query parameters:

- `page`, `pageSize` - Pagination (pageSize: 10-500, default 50).
- `sortBy`, `sortDir` - Column sorting (asc/desc). Column keys are whitelisted to prevent SQL injection.
- `search` - Free-text search across VIN, rooftop name, CSM email, enterprise name.
- `dateFilter` - One of: `post`, `pre`, or omit for all.
- `enterpriseId`, `rooftopId`, `csm`, `status`, `rooftopType`, `after24h`, `hasPhotos`, `reasonBucket` - Exact-match filters.

---

## Database Schema

### Tables

**`vins`** - Raw VIN inventory records (primary key: `vin`)

| Column          | Type     | Description                                          |
| --------------- | -------- | ---------------------------------------------------- |
| vin             | TEXT PK  | VIN identifier                                       |
| dealer_vin_id   | TEXT     | Dealer's VIN ID                                      |
| enterprise_id   | TEXT     | Parent enterprise                                    |
| rooftop_id      | TEXT     | Parent rooftop (team)                                |
| status          | TEXT     | `Delivered` or other (pending)                       |
| after_24h       | SMALLINT | 1 if pending for more than 24 hours                  |
| received_at     | TEXT     | When the VIN was received                            |
| processed_at    | TEXT     | When the VIN was delivered/processed                 |
| reason_bucket   | TEXT     | Why pending: Processing Pending, Publishing Pending, QC Pending, QC Hold, Sold, Others |
| hold_reason     | TEXT     | Detailed hold reason text                            |
| has_photos      | SMALLINT | 1 if photos have been uploaded                       |
| synced_at       | TEXT     | Timestamp of last sync                               |

**`rooftop_details`** - Rooftop/dealership metadata (primary key: `team_id`)

| Column                 | Type | Description                                    |
| ---------------------- | ---- | ---------------------------------------------- |
| team_id                | TEXT PK | Rooftop identifier                          |
| enterprise_id          | TEXT | Parent enterprise                              |
| team_name              | TEXT | Display name                                   |
| team_type              | TEXT | Franchise Group/Individual, Independent Group/Individual, Others |
| website_score          | REAL | Overall website quality score                  |
| website_listing_url    | TEXT | URL of the website listing                     |
| ims_integration_status | TEXT | `true`/`false` string                          |
| publishing_status      | TEXT | `true`/`false` string                          |

**`enterprise_details`** - Enterprise/organization metadata (primary key: `enterprise_id`)

| Column         | Type | Description                                          |
| -------------- | ---- | ---------------------------------------------------- |
| enterprise_id  | TEXT PK | Enterprise identifier                             |
| name           | TEXT | Enterprise display name                              |
| type           | TEXT | Account type                                         |
| website_url    | TEXT | Enterprise website URL                               |
| poc_email      | TEXT | Point of contact / CSM email address                 |

**`sync_state`** - Single-row distributed sync lock (primary key: `id` = `'global'`)

| Column       | Type         | Description                                         |
| ------------ | ------------ | --------------------------------------------------- |
| running      | BOOLEAN      | Whether a sync is currently in progress              |
| started_at   | TIMESTAMPTZ  | When the current/last sync started                   |
| completed_at | TIMESTAMPTZ  | When the last successful sync completed              |
| total_rows   | INTEGER      | Total VIN count after last sync                      |
| last_sync    | TEXT         | Max `synced_at` from vins table                      |

**`summary_cache`** - Precomputed summary payloads (primary key: `date_filter`)

Stores the JSON output of `computeSummary()` for each date filter variant (`all`, `post`, `pre`). Updated at the end of every successful sync. This makes `GET /api/summary` a single-row lookup (<5ms).

**`filter_cache`** - Precomputed filter dropdown options (single row, key: `'global'`)

Stores the JSON output of `computeFilterOptions()`. Updated at the end of every successful sync. This makes `GET /api/filter-options` a single-row lookup.

### Materialized Views

**`v_by_rooftop`** - Pre-aggregated stats per rooftop. Joins vins + rooftop_details + enterprise_details. Refreshed concurrently after each sync.

**`v_by_enterprise`** - Pre-aggregated stats per enterprise. Same join structure. Refreshed concurrently after each sync.

Both views have unique indexes (`uix_mv_rooftop_id`, `uix_mv_enterprise_id`) to enable `REFRESH MATERIALIZED VIEW CONCURRENTLY`, which avoids locking out read queries during refresh.

### Indexes on `vins`

- `idx_vins_rooftop_id` - Rooftop lookups
- `idx_vins_enterprise_id` - Enterprise lookups
- `idx_vins_status` - Status filtering
- `idx_vins_received_at` - Date range queries
- `idx_vins_has_photos` - Photo filter
- `idx_vins_reason_bucket` - Reason bucket filter
- `idx_vins_status_photos_24h` - Composite index for the most common combined filter

---

## Local Development Setup

### Prerequisites

- Node.js 18+ (ES Module support required)
- A PostgreSQL database (Supabase recommended, or any local Postgres instance)
- npm

### 1. Clone the repository

```bash
git clone <repo-url>
cd VIN-tracker-Dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a file called `database_url.env` in the project root (this is what `npm run server` reads):

```env
VIN_TRACKER_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

If using Supabase, go to your project dashboard, then **Connect** and copy the **Transaction mode** connection string (port 6543).

For the email functionality (optional for local dev), you also need these in your environment:

```env
INTERNAL_EMAIL_API_URL=https://mail.spyne.ai/api/v1/send-template-email
EMAIL_TO=your-email@spyne.ai
EMAIL_CC=optional-cc@spyne.ai
EMAIL_BCC=optional-bcc@spyne.ai
DASHBOARD_URL=http://localhost:5173/
```

### 4. Start the development servers

```bash
npm start
```

This runs two processes concurrently:
- **Vite dev server** on `http://localhost:5173` (frontend with hot reload)
- **Express API server** on `http://localhost:3002` (backend)

Vite is configured to proxy `/api/*` requests to the Express server and `/metabase-api/*` to `metabase.spyne.ai`, so you only need to open `http://localhost:5173` in your browser.

### 5. Trigger an initial data sync

Open the dashboard in your browser and click the **"Sync Now"** button, or run:

```bash
curl -X POST http://localhost:3002/api/sync
```

This will fetch data from Metabase, populate the database, and precompute all caches. The first sync may take 1-2 minutes depending on the VIN dataset size.

---

## Deployment (Vercel)

### Configuration

The `vercel.json` file defines the deployment config:

- **Build**: `npm run build` outputs to `dist/`.
- **Rewrites**: All `/api/*` requests route to the serverless function at `api/index.js`. Everything else serves `index.html` (SPA routing).
- **Function timeout**: `maxDuration: 300` (5 minutes) to accommodate long sync operations.
- **Cron jobs**: Three schedules triggering `/api/scheduled-report`.

### Environment variables to set in Vercel

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `VIN_TRACKER_DATABASE_URL` | Supabase Postgres connection string (transaction mode) |
| `INTERNAL_EMAIL_API_URL` | Internal email service endpoint                          |
| `EMAIL_TO`               | Primary email recipients (comma-separated)               |
| `EMAIL_CC`               | CC recipients (optional)                                 |
| `EMAIL_BCC`              | BCC recipients (optional)                                |
| `DASHBOARD_URL`          | Production dashboard URL (for the CTA button in emails)  |
| `CRON_SECRET`            | Auto-set by Vercel for cron authentication               |

### How the serverless function works

The file `api/index.js` is the Vercel serverless entry point. It imports the Express app from `server/app.js`, initializes the database schema on cold start (`initSchema()`), and handles all API routes through a single function.

Since Vercel serverless functions are stateless, the connection pool is kept minimal (`max: 1`) and the schema is re-initialized on every cold start (all operations are idempotent with `IF NOT EXISTS`). Materialized views are dropped and recreated on cold start to pick up any schema changes automatically.

---

## Troubleshooting

### Sync stuck in "running" state

If a serverless function times out mid-sync, the `sync_state.running` flag can get stuck at `TRUE`. This blocks all future syncs. To fix, run this SQL directly on your Supabase database:

```sql
UPDATE sync_state SET running = FALSE WHERE id = 'global';
```

### Metabase timeout errors

The VIN dataset fetch from Metabase can take 60+ seconds. The code uses a 65-second timeout per attempt with 1 retry. If you see repeated timeout errors in the Vercel function logs, check if the Metabase card query needs optimization.

### Email not sending

Check the Vercel function logs for `[email]` prefixed messages. Common issues:
- `INTERNAL_EMAIL_API_URL` not set in Vercel environment variables.
- `EMAIL_TO` not set.
- The internal email API is rejecting the request (check the response body in logs).

### Dashboard showing stale data

The dashboard reads from precomputed caches that are refreshed at the end of each sync. If the last sync failed (VINs critical failure), the caches won't be updated. Check `GET /api/sync/status` to see if `completedAt` is recent. If not, trigger a manual sync.

### Cold start latency

The first API request after a deployment or period of inactivity will be slow (~2-5 seconds) because the serverless function needs to initialize the DB schema and recreate materialized views. Subsequent requests are fast (<50ms for cached endpoints).

---

## Project File Structure

```
VIN-tracker-Dashboard/
  api/
    index.js              # Vercel serverless entry point
  server/
    app.js                # Express app: all API routes, sync logic, query builders
    db.js                 # PostgreSQL pool, schema init, materialized views
    emailTemplate.js      # HTML email template builder
    emailClient.js        # Email sending client (internal API)
    index.js              # Local dev server entry point
  src/
    main.jsx              # React app entry point
  scripts/
    preview-email.js      # Utility to preview the email HTML locally
  .env.example            # Template for environment variables
  vercel.json             # Vercel deployment config (rewrites, crons, function settings)
  vite.config.js          # Vite config with dev proxy settings
  package.json            # Dependencies and npm scripts
```
