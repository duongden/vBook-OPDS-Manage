CREATE TABLE opds_sources (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  short_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  config_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX opds_sources_library ON opds_sources(library_id, created_at);
