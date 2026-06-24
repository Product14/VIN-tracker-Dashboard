-- 360 spin VIN-Data drill-down indexes, parallel to the catalog indexes on the vins
-- table (idx_vins_status / idx_vins_reason_bucket / idx_vins_status_photos_24h). Without
-- these, the spin /api/vins list query (filtering output_processing_spin / spin_status /
-- spin_reason_bucket / spin_after_6h) sequentially scans ~317k rows. Purely additive,
-- idempotent, no materialized-view rebuild. initSchema creates the same indexes on cold
-- start (IF NOT EXISTS), so this just front-loads them at deploy/build time.
CREATE INDEX IF NOT EXISTS idx_vins_output_processing_spin ON vins(output_processing_spin);
CREATE INDEX IF NOT EXISTS idx_vins_spin_status_photos_6h  ON vins(spin_status, has_photos, spin_after_6h);
CREATE INDEX IF NOT EXISTS idx_vins_spin_reason_bucket     ON vins(spin_reason_bucket);
