-- No column in any table holds personal information (spec §7).

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  open_date TEXT NOT NULL,
  close_date TEXT NOT NULL,
  max_people INTEGER NOT NULL DEFAULT 5,
  reset_seconds INTEGER NOT NULL DEFAULT 60,
  notice TEXT NOT NULL DEFAULT ''
);
INSERT INTO settings (id, open_date, close_date) VALUES (1, '2026-11-07', '2026-11-08');

CREATE TABLE slot_templates (
  id INTEGER PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  valid_from TEXT,
  valid_to TEXT
);

-- status: open | stopped | deleted (soft delete so regeneration from templates does not resurrect it)
CREATE TABLE slots (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  status TEXT NOT NULL DEFAULT 'open',
  template_id INTEGER,
  UNIQUE (date, start_time)
);

-- kind: once | weekly | monthly | slot
CREATE TABLE blackout_rules (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  date_from TEXT,
  date_to TEXT,
  weekday INTEGER,
  nth INTEGER,
  time_from TEXT,
  time_to TEXT,
  slot_id INTEGER,
  memo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY,
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  people INTEGER NOT NULL CHECK (people > 0),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- active | cancelled
  created_at TEXT NOT NULL,
  created_by_type TEXT NOT NULL, -- device | admin
  created_by_id INTEGER NOT NULL,
  cancelled_at TEXT
);
CREATE INDEX reservations_slot ON reservations (slot_id, status);

CREATE TABLE devices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- device | admin | anonymous
  actor_id INTEGER,
  action TEXT NOT NULL,
  target_id INTEGER
);
CREATE INDEX audit_logs_action_at ON audit_logs (action, at);
