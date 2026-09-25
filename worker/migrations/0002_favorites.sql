CREATE TABLE IF NOT EXISTS favorites (
  user_hash TEXT NOT NULL,
  course_id TEXT NOT NULL,
  item_path TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('dir', 'file')),
  item_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_hash, course_id, item_path)
);

CREATE INDEX IF NOT EXISTS favorites_by_user ON favorites(user_hash, created_at DESC);
