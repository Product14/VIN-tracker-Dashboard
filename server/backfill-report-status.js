/**
 * One-time backfill script: populates rooftop_report_status_daily for all
 * completed non-test daily report runs.
 *
 * Usage:
 *   VIN_TRACKER_DATABASE_URL="postgresql://..." node server/backfill-report-status.js
 *
 * Safe to re-run — every INSERT uses ON CONFLICT DO UPDATE (upsert).
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.VIN_TRACKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const query = (text, params) => pool.query(text, params);

async function writeSnapshot(runId) {
  await query(`
    INSERT INTO rooftop_report_status_daily
      (report_day, rooftop_id, enterprise_id, status, error_reason)
    WITH
    report_sent AS (
      SELECT
        rq.rooftop_id              AS r_id,
        rq.enterprise_id,
        (rq.report_date::date - 1) AS r_date,
        rq.status,
        NULL::text                 AS error_reason,
        1                          AS priority
      FROM report_queue rq
      WHERE rq.run_id = $1
        AND rq.status = 'sent'
        AND rq.report_type = 'Rooftop'
        AND rq.report_date IS NOT NULL
    ),
    group_sent AS (
      SELECT
        rv.rooftop_id              AS r_id,
        rq.enterprise_id,
        (rq.report_date::date - 1) AS r_date,
        rq.status,
        NULL::text                 AS error_reason,
        1                          AS priority
      FROM report_queue rq
      JOIN v_by_rooftop rv ON rv.enterprise_id = rq.enterprise_id
      WHERE rq.run_id = $1
        AND rq.status = 'sent'
        AND rq.report_type = 'Group'
        AND rq.report_date IS NOT NULL
    ),
    rooftop_not_sent AS (
      SELECT DISTINCT ON (rq.rooftop_id, (rq.report_date::date - 1))
        rq.rooftop_id              AS r_id,
        rq.enterprise_id,
        (rq.report_date::date - 1) AS r_date,
        rq.status,
        rq.error_reason,
        2                          AS priority
      FROM report_queue rq
      WHERE rq.run_id = $1
        AND rq.status != 'sent'
        AND rq.report_type = 'Rooftop'
        AND rq.report_date IS NOT NULL
      ORDER BY rq.rooftop_id, (rq.report_date::date - 1), rq.id DESC
    ),
    group_not_sent AS (
      SELECT DISTINCT ON (rq.enterprise_id, (rq.report_date::date - 1))
        rv.rooftop_id              AS r_id,
        rq.enterprise_id,
        (rq.report_date::date - 1) AS r_date,
        rq.status,
        rq.error_reason,
        3                          AS priority
      FROM report_queue rq
      JOIN v_by_rooftop rv ON rv.enterprise_id = rq.enterprise_id
      WHERE rq.run_id = $1
        AND rq.status != 'sent'
        AND rq.report_type = 'Group'
        AND rq.report_date IS NOT NULL
      ORDER BY rq.enterprise_id, (rq.report_date::date - 1), rq.id DESC
    ),
    all_data AS (
      SELECT * FROM report_sent
      UNION ALL SELECT * FROM group_sent
      UNION ALL SELECT * FROM rooftop_not_sent
      UNION ALL SELECT * FROM group_not_sent
    ),
    final AS (
      SELECT DISTINCT ON (r_id, r_date)
        r_id, enterprise_id, r_date, status, error_reason
      FROM all_data
      WHERE r_id IS NOT NULL AND r_date IS NOT NULL
      ORDER BY r_id, r_date, priority
    )
    SELECT r_date, r_id, enterprise_id, status, error_reason FROM final
    ON CONFLICT (report_day, rooftop_id)
    DO UPDATE SET
      status        = EXCLUDED.status,
      error_reason  = EXCLUDED.error_reason,
      enterprise_id = EXCLUDED.enterprise_id
  `, [runId]);
}

async function main() {
  if (!process.env.VIN_TRACKER_DATABASE_URL) {
    console.error("Error: VIN_TRACKER_DATABASE_URL is not set.");
    process.exit(1);
  }

  const { rows: runs } = await query(`
    SELECT run_id, completed_at
    FROM daily_report_runs
    WHERE test_mode = false AND status = 'done'
    ORDER BY completed_at ASC
  `);

  console.log(`Found ${runs.length} completed runs to backfill.`);

  let succeeded = 0;
  let failed = 0;

  for (const { run_id, completed_at } of runs) {
    try {
      await writeSnapshot(run_id);
      succeeded++;
      process.stdout.write(`\r  ${succeeded + failed}/${runs.length} — last: ${run_id} (${String(completed_at).slice(0, 10)})`);
    } catch (err) {
      failed++;
      console.error(`\nFailed for run ${run_id}: ${err.message}`);
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  await pool.end();
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
