-- Migration 003 incorrectly swapped the PK to vin. Revert it back to dealer_vin_id.
-- Truncate first since sync always replaces all data anyway.
TRUNCATE TABLE vins;
ALTER TABLE vins DROP CONSTRAINT vins_pkey;
ALTER TABLE vins ADD PRIMARY KEY (dealer_vin_id);
