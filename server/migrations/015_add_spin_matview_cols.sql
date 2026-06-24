-- 360 spin aggregate columns added to v_by_rooftop / v_by_enterprise (parallel to the
-- catalog columns) so one MV row serves both the catalog and the 360 spin tracks:
--   spin_requested, spin_with_photos, spin_delivered_with_photos, spin_pending_with_photos,
--   spin_processed, spin_not_processed, spin_not_processed_after_24h, and 6 spin_bucket_* cols.
-- The materialized views are CREATE ... IF NOT EXISTS in initSchema and never dropped on cold
-- start, so a definition change must drop them explicitly here; the CREATE ... IF NOT EXISTS
-- then rebuilds them with the new spin columns (mirrors migrations 012 / 013).
DROP MATERIALIZED VIEW IF EXISTS v_by_rooftop;
DROP MATERIALIZED VIEW IF EXISTS v_by_enterprise;
