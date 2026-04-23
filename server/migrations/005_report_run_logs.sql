CREATE TABLE IF NOT EXISTS report_run_logs (
  id          SERIAL PRIMARY KEY,
  run_id      TEXT        NOT NULL,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  test_mode   BOOLEAN     NOT NULL DEFAULT FALSE,
  report_type TEXT,
  entity_id   TEXT,
  name        TEXT,
  email       TEXT,
  status      TEXT        NOT NULL,
  reason      TEXT
);
CREATE INDEX IF NOT EXISTS idx_report_run_logs_run_id ON report_run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_report_run_logs_run_at ON report_run_logs(run_at DESC);
