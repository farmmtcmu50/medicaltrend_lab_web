-- Back office: staff notes and an audit trail of who changed what.

ALTER TABLE bookings ADD COLUMN staff_note TEXT;
ALTER TABLE bookings ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS booking_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  at           TEXT NOT NULL,                 -- ISO 8601 UTC
  actor        TEXT NOT NULL,                 -- staff email, or 'customer' for web bookings
  action       TEXT NOT NULL CHECK (action IN ('created', 'status', 'note')),
  from_status  TEXT,
  to_status    TEXT,
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_booking ON booking_events (booking_id, at);

-- Bookings made before this migration get their 'created' event.
INSERT INTO booking_events (booking_id, at, actor, action, to_status)
SELECT id, created_at, 'customer', 'created', 'pending' FROM bookings
WHERE id NOT IN (SELECT booking_id FROM booking_events WHERE action = 'created');
