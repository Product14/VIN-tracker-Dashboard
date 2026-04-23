-- The live DB incorrectly has dealer_vin_id as the primary key.
-- db.js defines vin as the PK. Fix it to match, so rows with null dealer_vin_id can sync.
-- Truncate first because current data may have duplicate vins (sync always replaces everything).
TRUNCATE TABLE vins;
ALTER TABLE vins DROP CONSTRAINT vins_pkey;
ALTER TABLE vins ADD PRIMARY KEY (vin);
ALTER TABLE vins ALTER COLUMN dealer_vin_id DROP NOT NULL;
