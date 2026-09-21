CREATE TABLE IF NOT EXISTS users (
  user_hash TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  launch_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL REFERENCES users(user_hash),
  event_type TEXT NOT NULL CHECK (event_type IN ('app_open', 'search', 'subject_open', 'material_open', 'yandex_disk_open')),
  subject_id TEXT NOT NULL DEFAULT '',
  material_id TEXT NOT NULL DEFAULT '',
  event_minute INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_hash, event_type, subject_id, material_id, event_minute)
);

CREATE INDEX IF NOT EXISTS events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS events_subject_popularity ON events(subject_id, created_at) WHERE subject_id != '';
CREATE INDEX IF NOT EXISTS events_material_popularity ON events(material_id, created_at) WHERE material_id != '';
