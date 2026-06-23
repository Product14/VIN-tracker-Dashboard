-- The 6h pendency predicate behind v_by_rooftop / v_by_enterprise changed from a
-- received_at/processed_at timestamp calculation to the Metabase card's
-- `after_6_hrs` flag (stored in vins.after_24h). Materialized views are created
-- with CREATE ... IF NOT EXISTS and left in place, so an existing MV keeps the
-- old definition. Drop them here (build-time, single process) so the runtime
-- CREATE ... IF NOT EXISTS in db.js rebuilds them with the new definition.
DROP MATERIALIZED VIEW IF EXISTS v_by_rooftop;
DROP MATERIALIZED VIEW IF EXISTS v_by_enterprise;
