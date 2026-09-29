-- Which page a booking came from: 'web' (main booking page) or 'std' (STD testing page /std).
ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings (source, visit_date);
