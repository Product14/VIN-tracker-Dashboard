-- Drop columns now derived from report_queue
ALTER TABLE daily_report_runs DROP COLUMN IF EXISTS params;
ALTER TABLE daily_report_runs DROP COLUMN IF EXISTS sent;
ALTER TABLE daily_report_runs DROP COLUMN IF EXISTS skipped;
ALTER TABLE daily_report_runs DROP COLUMN IF EXISTS errors;

-- Add test mode override recipients (used by processor instead of report_queue.email)
ALTER TABLE daily_report_runs ADD COLUMN IF NOT EXISTS test_to TEXT[];
ALTER TABLE daily_report_runs ADD COLUMN IF NOT EXISTS test_cc TEXT[];
