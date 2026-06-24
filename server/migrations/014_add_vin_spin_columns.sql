-- 360 Spin funnel columns emitted by the updated VIN card, mirroring the catalog
-- funnel one-to-one:
--   spin_status            ↔ status                    (No Photos / Delivered / Not Delivered)
--   spin_after_6h          ↔ after_24h                 (Yes/No pendency >6h; named for the real 6h SLA)
--   spin_sent_at           ↔ processed_at              (spin delivery timestamp; CSV spinSentAt)
--   spin_reason_bucket     ↔ reason_bucket             (spin pending reason)
--   spin_qc_on             ↔ is_qc_on                  (0/1 spin QC enabled)
--   output_processing_spin ↔ output_processing_catalog (0/1 VIN is in the spin funnel)
-- Ingested for storage only — no API/UI/summary consumers yet. NULL on legacy cards.
-- No matview change (spin is not aggregated this pass), so unlike 012 we do not drop them.
ALTER TABLE vins ADD COLUMN IF NOT EXISTS spin_status            TEXT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS spin_after_6h          SMALLINT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS spin_sent_at           TEXT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS spin_reason_bucket     TEXT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS spin_qc_on             SMALLINT;
ALTER TABLE vins ADD COLUMN IF NOT EXISTS output_processing_spin SMALLINT;
