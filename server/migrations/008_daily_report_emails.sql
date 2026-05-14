-- Drop the rooftop-only table if a previous version of migration 008 was
-- applied locally during development. Safe on fresh deploys (no-op).
DROP TABLE IF EXISTS rooftop_daily_report_emails;

CREATE TABLE IF NOT EXISTS daily_report_emails (
  -- Identity (mirrors the report_queue row this archives)
  report_type      TEXT        NOT NULL CHECK (report_type IN ('Rooftop', 'Group')),
  rooftop_id       TEXT,                                             -- set when 'Rooftop'; NULL for 'Group'
  enterprise_id    TEXT        NOT NULL,                             -- always set (parent for Rooftop, the entity itself for Group)
  report_day       DATE        NOT NULL,
  is_test          BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Payload
  html             TEXT        NOT NULL,
  subject          TEXT,
  to_emails        TEXT[],
  cc_emails        TEXT[],
  -- Audit (pointer back to the source queue row + run, plus a denorm name)
  report_queue_id  INT,
  run_id           TEXT,
  entity_name      TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((report_type = 'Rooftop' AND rooftop_id IS NOT NULL) OR
         (report_type = 'Group'   AND rooftop_id IS NULL))
);

-- Each report_type has its own natural-key identity. Partial unique indexes
-- enforce uniqueness within each type and support ON CONFLICT inserts.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_report_emails_rooftop
  ON daily_report_emails (rooftop_id, report_day, is_test)
  WHERE report_type = 'Rooftop';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_report_emails_group
  ON daily_report_emails (enterprise_id, report_day, is_test)
  WHERE report_type = 'Group';

CREATE INDEX IF NOT EXISTS idx_daily_report_emails_day
  ON daily_report_emails (report_day DESC);
