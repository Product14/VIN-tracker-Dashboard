-- Customer segment (Ent / Mid / SMB) emitted by the VIN card (CSV column customer_segment).
-- Drives the Studio Health Images section's ENT/MID/SMB columns.
ALTER TABLE vins ADD COLUMN IF NOT EXISTS customer_segment TEXT;
