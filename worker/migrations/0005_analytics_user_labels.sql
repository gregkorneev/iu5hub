CREATE TABLE analytics_user_labels (
  user_hash TEXT PRIMARY KEY,
  username TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_hash) REFERENCES users(user_hash) ON DELETE CASCADE
);

CREATE INDEX users_last_seen ON users(last_seen_at DESC, user_hash);
