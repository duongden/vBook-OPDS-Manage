ALTER TABLE libraries ADD COLUMN short_id TEXT;

-- Existing libraries receive a compact public route while keeping their UUID route valid.
UPDATE libraries SET short_id = lower(hex(randomblob(6))) WHERE short_id IS NULL;

CREATE UNIQUE INDEX libraries_short_id ON libraries(short_id);
