CREATE TABLE IF NOT EXISTS support_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  user_chat_ciphertext TEXT NOT NULL,
  user_message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_hash, user_message_id)
);

CREATE INDEX IF NOT EXISTS support_requests_user_time ON support_requests(user_hash, created_at);
CREATE INDEX IF NOT EXISTS support_requests_created_at ON support_requests(created_at);

CREATE TABLE IF NOT EXISTS support_routes (
  admin_chat_id INTEGER NOT NULL,
  admin_message_id INTEGER NOT NULL,
  request_id INTEGER NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (admin_chat_id, admin_message_id)
);

CREATE INDEX IF NOT EXISTS support_routes_request ON support_routes(request_id);
