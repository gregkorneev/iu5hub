ALTER TABLE users ADD COLUMN legacy_anonymous_aggregate INTEGER NOT NULL DEFAULT 0 CHECK (legacy_anonymous_aggregate IN (0, 1));

CREATE TABLE analytics_legacy_anonymous_summary (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_count INTEGER NOT NULL,
  launch_count INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  snapshot_at INTEGER NOT NULL
);

INSERT INTO analytics_legacy_anonymous_summary (id, user_count, launch_count, first_seen_at, last_seen_at, snapshot_at)
SELECT 1, COUNT(*), COALESCE(SUM(u.launch_count), 0), MIN(u.first_seen_at), MAX(u.last_seen_at), unixepoch()
FROM users u LEFT JOIN analytics_user_labels l ON l.user_hash = u.user_hash
WHERE l.username IS NULL
HAVING COUNT(*) > 0;

UPDATE users SET legacy_anonymous_aggregate = 1
WHERE user_hash IN (
  SELECT u.user_hash FROM users u LEFT JOIN analytics_user_labels l ON l.user_hash = u.user_hash
  WHERE l.username IS NULL
);
