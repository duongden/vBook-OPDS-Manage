-- Monotonic credential version prevents stale logins from restoring revoked sessions.
ALTER TABLE libraries ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
