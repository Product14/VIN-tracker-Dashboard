CREATE TABLE IF NOT EXISTS report_queue (
  id                    SERIAL PRIMARY KEY,
  run_id                TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  rooftop_id            TEXT,
  enterprise_id         TEXT,
  report_type           TEXT        NOT NULL,  -- 'Rooftop' | 'Group'
  entity_id             TEXT,                  -- rooftop_id or enterprise_id (set after processing)
  entity_name           TEXT,                  -- dealership/group name (set after processing)
  status                TEXT        NOT NULL DEFAULT 'pending',
                                               -- pending | processing | sent | skipped | error
  attempt_count         INT         NOT NULL DEFAULT 0,
  error_reason          TEXT,
  to_emails             TEXT[],
  cc_emails             TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,           -- set when status → processing
  processed_at          TIMESTAMPTZ            -- set when status → sent/skipped/error
);

CREATE INDEX IF NOT EXISTS idx_report_queue_pending    ON report_queue(status, created_at)           WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_report_queue_processing ON report_queue(status, processing_started_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_report_queue_run_id     ON report_queue(run_id, status);
