-- STEP 2 "popular" cards, managed in the Booking Console. Seeded with the cards that were built into the site.
CREATE TABLE IF NOT EXISTS popular_items (
  id          TEXT PRIMARY KEY,
  sort        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,          -- 1 = shown on the booking page
  name        TEXT NOT NULL UNIQUE,                -- Thai name; also the cart / pricing key
  name_en     TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  detail_en   TEXT NOT NULL DEFAULT '',
  price       INTEGER,                             -- NULL when tiered or priced from the sheet code
  was         INTEGER,                             -- struck-through price
  tiers_json  TEXT,                                -- [{"label":"3 เชื้อ","price":1200}, ...]
  code        TEXT,                                -- optional sheet code: price follows the Master Price List
  poster      TEXT NOT NULL,                       -- /img/... (built in) or /api/posters/<file> (R2)
  std_link    INTEGER NOT NULL DEFAULT 0,          -- 1 = card links to /std instead of the cart
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_popular_sort ON popular_items (active, sort);

INSERT OR IGNORE INTO popular_items (id, sort, active, name, name_en, detail, detail_en, price, was, tiers_json, code, poster, std_link, updated_at, updated_by) VALUES
('seed-1', 1, 1, 'ตรวจสารก่อภูมิแพ้ 107 ชนิด', 'Allergy test, 107 allergens', 'IgE Specific Allergens 107 ชนิด · รายงานผล 1 วันทำการ · Class 0–6 ตามมาตรฐานสากล', 'Specific IgE, 107 allergens · results in 1 business day · Class 0–6 international scale', 3500, NULL, NULL, NULL, '/img/poster-allergy.webp', 0, '2026-09-29T00:00:00.000Z', 'seed'),
('seed-2', 2, 1, 'แพ็กเกจโรคติดต่อทางเพศสัมพันธ์ 6 รายการ', 'STD package, 6 tests', 'HIV Ag/Ab 4th Gen, HBsAg, Anti-HBs, Anti-HCV, Syphilis VDRL (RPR), Syphilis Anti-TP · รอผลไม่เกิน 1 ชั่วโมง', 'HIV Ag/Ab 4th Gen, HBsAg, Anti-HBs, Anti-HCV, Syphilis VDRL (RPR), Syphilis Anti-TP · results within 1 hour', 880, NULL, NULL, NULL, '/img/poster-std6.webp', 1, '2026-09-29T00:00:00.000Z', 'seed'),
('seed-3', 3, 1, 'ตรวจ HPV DNA 15 Genotype', 'HPV DNA test, 15 genotypes', 'เก็บตัวอย่างด้วยตัวเอง ไม่ต้องขึ้นขาหยั่ง · รายงานผลแยกครบ 15 genotypes ภายใน 3 วันทำการ', 'Self-collected, no exam chair needed · all 15 genotypes reported within 3 business days', 890, NULL, NULL, NULL, '/img/poster-hpv15.webp', 0, '2026-09-29T00:00:00.000Z', 'seed'),
('seed-4', 4, 1, 'ตรวจโรคติดต่อทางเพศสัมพันธ์ 14 โรค', 'STD test, 14 infections', 'Realtime PCR เลือกตรวจเฉพาะเชื้อที่ต้องการได้ · ผลออกภายใน 3 วัน', 'Realtime PCR, choose only the pathogens you need · results within 3 days', NULL, NULL, '[{"label":"3 เชื้อ","price":1200},{"label":"7 เชื้อ","price":1600},{"label":"11 เชื้อ","price":1800},{"label":"14 เชื้อ","price":2100}]', NULL, '/img/poster-std14.webp', 1, '2026-09-29T00:00:00.000Z', 'seed');
