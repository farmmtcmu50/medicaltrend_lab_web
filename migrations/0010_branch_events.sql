-- Allow 'branch' events (staff moved a home-collection booking to another branch). SQLite cannot change
-- a CHECK constraint, so the table is rebuilt with the same columns and rows.
-- from_status / to_status hold the old / new branch id for these events.
CREATE TABLE booking_events_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  at           TEXT NOT NULL,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('created', 'status', 'note', 'items', 'branch')),
  from_status  TEXT,
  to_status    TEXT,
  note         TEXT
);
INSERT INTO booking_events_new (id, booking_id, at, actor, action, from_status, to_status, note)
  SELECT id, booking_id, at, actor, action, from_status, to_status, note FROM booking_events;
DROP TABLE booking_events;
ALTER TABLE booking_events_new RENAME TO booking_events;
CREATE INDEX IF NOT EXISTS idx_events_booking ON booking_events (booking_id, at);
