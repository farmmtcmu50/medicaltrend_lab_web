-- STEP 3 packages, managed in the Booking Console. Empty table = the page lists the Master Price List PAC-xx rows
-- as before; the Console fills it from the sheet the first time the Packages page is opened.
CREATE TABLE IF NOT EXISTS package_items (
  id          TEXT PRIMARY KEY,
  sort        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,          -- 1 = shown on the booking page
  code        TEXT,                                -- sheet code (PAC-xx): price follows the Master Price List
  name        TEXT NOT NULL UNIQUE,                -- Thai name; also the cart / pricing key
  name_en     TEXT NOT NULL DEFAULT '',
  detail      TEXT NOT NULL DEFAULT '',
  detail_en   TEXT NOT NULL DEFAULT '',
  price       INTEGER,                             -- used when there is no code (or the code is not in the sheet)
  poster      TEXT NOT NULL DEFAULT '',            -- '' = built-in poster by name; /api/posters/<file> = uploaded
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_package_sort ON package_items (active, sort);
