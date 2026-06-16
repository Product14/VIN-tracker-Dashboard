-- Per-VIN publishing/QC flags emitted by the expanded VIN card (publishing-on + off).
-- Lands the columns deterministically at deploy time; NULL on legacy data is treated
-- as publishing-ON downstream via COALESCE(is_publishing, 1).
ALTER TABLE vins ADD COLUMN IF NOT EXISTS is_publishing SMALLINT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS is_qc_on      SMALLINT;
CREATE INDEX IF NOT EXISTS idx_vins_is_publishing ON vins(is_publishing);
