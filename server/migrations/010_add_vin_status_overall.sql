-- Overall processing status emitted by the VIN card (CSV column status_overallStatus,
-- e.g. "DONE") — distinct from the delivery `status` column (Delivered / Not Delivered).
ALTER TABLE vins ADD COLUMN IF NOT EXISTS status_overall_status TEXT;
