CREATE TABLE opds_aggregate_states (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX opds_aggregate_states_expiry ON opds_aggregate_states(expires_at);
