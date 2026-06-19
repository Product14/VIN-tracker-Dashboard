-- Catalog-output flag emitted by the VIN card (CSV column outputProcessingList_catalog, 0/1).
-- The updated card no longer pre-filters non-catalog VINs; it emits them with a blank delivery
-- status. Pending/funnel metrics scope to COALESCE(output_processing_catalog,1)=1 so those rows
-- stop inflating Not-Delivered / pendency counts (~39k of 311k on the test card). Active-inventory
-- counts keep all rows. NULL on legacy data is treated as in-funnel (1), mirroring is_publishing.
ALTER TABLE vins ADD COLUMN IF NOT EXISTS output_processing_catalog SMALLINT;

-- The materialized views v_by_rooftop / v_by_enterprise are CREATE ... IF NOT EXISTS in initSchema
-- and never dropped on cold start, so a definition change must drop them explicitly here; the
-- CREATE ... IF NOT EXISTS then rebuilds them with the new catalog-scoped pending aggregates.
DROP MATERIALIZED VIEW IF EXISTS v_by_rooftop;
DROP MATERIALIZED VIEW IF EXISTS v_by_enterprise;
