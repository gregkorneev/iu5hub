CREATE TABLE IF NOT EXISTS profile_preferences (
  user_hash TEXT PRIMARY KEY,
  schedule_group_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
