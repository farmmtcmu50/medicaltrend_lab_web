-- Customer emails sent through Resend (booking confirmation, price, appointment confirmed, cancelled, reminder).
CREATE TABLE IF NOT EXISTS email_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                 -- booked / priced / confirmed / cancelled / reminder
  at           TEXT NOT NULL,                 -- ISO 8601 UTC
  to_addr      TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_id  TEXT,                          -- Resend email id
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_booking ON email_log (booking_id, at);
