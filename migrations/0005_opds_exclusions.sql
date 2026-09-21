CREATE TABLE opds_exclusions (
  library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES opds_sources(id) ON DELETE CASCADE,
  book_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (library_id, source_id, book_key)
);

CREATE INDEX opds_exclusions_source ON opds_exclusions(source_id);
