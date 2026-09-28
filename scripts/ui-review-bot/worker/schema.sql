CREATE TABLE IF NOT EXISTS commands (
  comment_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ceiling INTEGER NOT NULL CHECK (ceiling >= 0),
  initial_spend INTEGER NOT NULL CHECK (initial_spend >= 0),
  halted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS review_requests (
  hash TEXT PRIMARY KEY,
  reserved INTEGER NOT NULL,
  charged INTEGER NOT NULL,
  status TEXT NOT NULL,
  response TEXT
);
