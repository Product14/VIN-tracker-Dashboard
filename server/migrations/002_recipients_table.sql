-- Drop email columns added in feat/daily-email-reports (replaced by email_recipients table)
ALTER TABLE rooftop_details    DROP COLUMN IF EXISTS recipient_email;
ALTER TABLE enterprise_details DROP COLUMN IF EXISTS group_recipient_email;

-- Recipient config uploaded via CSV — maps email addresses to rooftop/enterprise IDs.
-- report_type: 'Rooftop' sends a per-rooftop report; 'Group' sends an enterprise-level report.
CREATE TABLE IF NOT EXISTS email_recipients (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  rooftop_id    TEXT,
  enterprise_id TEXT,
  report_type   TEXT NOT NULL
);
