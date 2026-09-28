-- Bookings from lab.medicaltrend.stream.
-- Prices are copied in at booking time, so later edits to the price sheet
-- never change what a customer was quoted.

CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,            -- uuid
  ref              TEXT NOT NULL UNIQUE,        -- customer-facing, e.g. MT-260928-4K7Q
  created_at       TEXT NOT NULL,               -- ISO 8601 UTC
  status           TEXT NOT NULL DEFAULT 'pending',
  mode             TEXT NOT NULL CHECK (mode IN ('lab', 'home')),
  branch           TEXT,                        -- lab mode: branch id
  visit_date       TEXT NOT NULL,               -- YYYY-MM-DD
  slot             TEXT NOT NULL,
  address          TEXT,                        -- home mode
  latitude         REAL,
  longitude        REAL,
  patient_type     TEXT,                        -- home mode: general / elderly / bedridden
  distance_km      INTEGER,                     -- home mode
  people           INTEGER NOT NULL,
  contact_name     TEXT NOT NULL,
  contact_phone    TEXT NOT NULL,
  contact_line     TEXT,
  contact_email    TEXT,
  note             TEXT,
  lab_order_key    TEXT,                        -- R2 object key of the doctor's lab order
  lab_order_name   TEXT,
  items_subtotal   INTEGER NOT NULL,
  travel_fee       INTEGER NOT NULL,
  total            INTEGER NOT NULL,
  price_source     TEXT NOT NULL,               -- live / cache / snapshot
  pdpa_consent_at  TEXT NOT NULL,
  lang             TEXT NOT NULL DEFAULT 'th'
);

CREATE INDEX IF NOT EXISTS idx_bookings_visit ON bookings (visit_date, slot);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (contact_phone);

CREATE TABLE IF NOT EXISTS booking_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  person_no   INTEGER NOT NULL,                 -- 1-based, matches "คนที่ N"
  kind        TEXT NOT NULL CHECK (kind IN ('package', 'test')),
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_booking ON booking_items (booking_id);

-- Last price list successfully read from the Google Sheet (retail columns only),
-- served when the sheet cannot be reached.
CREATE TABLE IF NOT EXISTS catalog_cache (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  rows_json   TEXT NOT NULL,
  synced_at   TEXT NOT NULL
);
