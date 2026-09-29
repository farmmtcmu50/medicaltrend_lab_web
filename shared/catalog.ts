// Catalog + pricing rules shared by the browser app and the Worker.
// The Worker recomputes every booking total with these same functions, so the
// price a customer sees and the price stored in D1 can never drift apart.
import snapshot from './catalog-snapshot.json';

export const SHEET_ID = '1YNt4ugp0EVdl7g4yXsMWGYwW-kyl-adVhFT6YaYcMs0';
export const SHEET_TAB = 'Master Capital';

/** One row of the price list (retail price only — cost columns never leave the Worker). */
export interface Test { c: string; n: string; th: string; p: number; w: string }
export interface Pkg { name: string; detail: string; price: number }
export interface Catalog {
  tests: Test[];
  packages: Pkg[];
  source: 'live' | 'cache' | 'snapshot';
  syncedAt: string | null;
}

export const PRICING = {
  baseVisitFee: 350,
  perKmRate: 25,
  freeKm: 10,
  minKm: 1,
  maxKm: 40,
  maxPeople: 8,
};

export const SLOTS = ['06:00–08:00', '08:00–10:00', '10:00–12:00', '16:00–18:00'] as const;
export const BRANCH_IDS = ['sankamphaeng', 'hangdong', 'watket', 'phayao'] as const;
export type BranchId = typeof BRANCH_IDS[number];
export const PATIENT_TYPES = ['general', 'elderly', 'bedridden'] as const;
export type PatientType = typeof PATIENT_TYPES[number];

/** Packages the sheet may not carry yet; the sheet version wins when a name matches. */
export const EXTRA_PKGS: Pkg[] = [
  { name: 'Signature ชาย', detail: 'ตรวจสุขภาพผู้ชายระดับ Signature เพิ่ม Cystatin C, GGT, Homocysteine, Cortisol และ Ferritin — 41 รายการ', price: 6990 },
  { name: 'Signature หญิง', detail: 'ตรวจสุขภาพผู้หญิงระดับ Signature เพิ่ม Cystatin C, GGT, Homocysteine, Cortisol และ Ferritin — 42 รายการ', price: 6990 },
  { name: 'Ultimate ชาย', detail: 'ตรวจสุขภาพผู้ชายแบบครอบคลุมสูงสุด เพิ่ม Insulin, HOMA-IR, Apo A1/Apo B, NT-proBNP, Vitamin B12, Folate — 51 รายการ', price: 12900 },
  { name: 'Ultimate หญิง', detail: 'ตรวจสุขภาพผู้หญิงแบบครอบคลุมสูงสุด เพิ่ม Insulin, HOMA-IR, Apo A1/Apo B, NT-proBNP, Vitamin B12, Folate — 52 รายการ', price: 12900 },
];

export interface PopularTier { label: string; price: number }
export interface Popular {
  name: string; nameEn: string; detail: string; detailEn: string;
  price?: number; was?: number; poster: string; tiers?: PopularTier[];
  /** Booked on the STD page (/std) instead of the main cart. */
  stdLink?: boolean;
}

export const POPULAR: Popular[] = [
  { nameEn: 'Allergy test, 107 allergens', detailEn: 'Specific IgE, 107 allergens · results in 1 business day · Class 0–6 international scale', name: 'ตรวจสารก่อภูมิแพ้ 107 ชนิด', detail: 'IgE Specific Allergens 107 ชนิด · รายงานผล 1 วันทำการ · Class 0–6 ตามมาตรฐานสากล', price: 3500, poster: '/img/poster-allergy.webp' },
  { nameEn: 'STD package, 6 tests', detailEn: 'HIV Ag/Ab 4th Gen, HBsAg, Anti-HBs, Anti-HCV, Syphilis VDRL (RPR), Syphilis Anti-TP · results within 1 hour', name: 'แพ็กเกจโรคติดต่อทางเพศสัมพันธ์ 6 รายการ', detail: 'HIV Ag/Ab 4th Gen, HBsAg, Anti-HBs, Anti-HCV, Syphilis VDRL (RPR), Syphilis Anti-TP · รอผลไม่เกิน 1 ชั่วโมง', price: 880, poster: '/img/poster-std6.webp', stdLink: true },
  { nameEn: 'HPV DNA test, 15 genotypes', detailEn: 'Self-collected, no exam chair needed · all 15 genotypes reported within 3 business days', name: 'ตรวจ HPV DNA 15 Genotype', detail: 'เก็บตัวอย่างด้วยตัวเอง ไม่ต้องขึ้นขาหยั่ง · รายงานผลแยกครบ 15 genotypes ภายใน 3 วันทำการ', price: 890, poster: '/img/poster-hpv15.webp' },
  { nameEn: 'STD test, 14 infections', detailEn: 'Realtime PCR, choose only the pathogens you need · results within 3 days', name: 'ตรวจโรคติดต่อทางเพศสัมพันธ์ 14 โรค', detail: 'Realtime PCR เลือกตรวจเฉพาะเชื้อที่ต้องการได้ · ผลออกภายใน 3 วัน', poster: '/img/poster-std14.webp', stdLink: true, tiers: [
    { label: '3 เชื้อ', price: 1200 }, { label: '7 เชื้อ', price: 1600 }, { label: '11 เชื้อ', price: 1800 }, { label: '14 เชื้อ', price: 2100 },
  ] },
];

/** Key under which a popular item (or one tier of it) is stored in a person's pks map. */
export const popularKey = (p: Popular, tier?: PopularTier) => tier ? p.name + ' · ' + tier.label : p.name;

/** Price for every selectable package-like key: sheet packages, extras, popular items and tiers. */
export function packagePrices(pkgs: Pkg[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pkgs) m.set(p.name, p.price);
  for (const p of POPULAR) {
    if (p.tiers) for (const t of p.tiers) m.set(popularKey(p, t), t.price);
    else if (p.price) m.set(p.name, p.price);
  }
  return m;
}

// ---------- sheet parsing ----------

export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Parses the sheet CSV, keeping only the public retail columns. Throws if the layout changed. */
export function parseSheet(csv: string): Test[] {
  const rows = csvRows(csv);
  const head = (rows[0] || []).map(h => h.trim());
  const col = (n: string) => head.indexOf(n);
  const iName = col('รายชื่อการทดสอบ'), iCat = col('ประเภท'), iDesc = col('คำอธิบาย'),
    iRetail = col('Retail'), iWait = col('เวลารอผล');
  if (iName < 0 || iRetail < 0) throw new Error('sheet columns changed');
  const tests = rows.slice(1).map(r => ({
    n: (r[iName] || '').trim(),
    c: (r[iCat] || '').trim() || 'อื่นๆ',
    th: (r[iDesc] || '').trim(),
    p: Math.round(Number(String(r[iRetail] || '').replace(/[^0-9.]/g, ''))),
    w: (r[iWait] || '').trim(),
  })).filter(t => t.n && t.p > 0);
  if (!tests.length) throw new Error('sheet empty');
  return tests;
}

/** Splits parsed rows into single tests and packages (plus extras), P1–P10 first. */
export function buildCatalog(rows: Test[], source: Catalog['source'], syncedAt: string | null): Catalog {
  let packages = rows.filter(t => t.c.toLowerCase() === 'package')
    .map(t => ({ name: t.n.replace(/^Package\s+/i, ''), detail: t.th, price: t.p }));
  packages = packages.concat(EXTRA_PKGS.filter(x =>
    !packages.some(p => p.name.toLowerCase() === x.name.toLowerCase())));
  packages.sort((a, b) => pkgRank(a.name) - pkgRank(b.name));
  return { tests: rows.filter(t => t.c.toLowerCase() !== 'package'), packages, source, syncedAt };
}

export const snapshotCatalog = (): Catalog => buildCatalog(snapshot as Test[], 'snapshot', null);

// ---------- ordering / posters ----------

const isFemale = (n: string) => /female|หญิง|\bf\b/.test(n);
const isMale = (n: string) => /male|ชาย|\bm\b/.test(n);

export function pkgRank(name: string): number {
  const n = (name || '').toLowerCase();
  const explicit = n.match(/^p(\d+)\b/);
  if (explicit) return Number(explicit[1]);
  const female = isFemale(n), male = isMale(n);
  if (/starter/.test(n)) return 1;
  if (/standard/.test(n)) return 2;
  if (/extra/.test(n)) return 3;
  if (/supreme/.test(n)) return 4;
  if (/beyond/.test(n)) return female ? 6 : 5;
  if (/signature/.test(n)) return female ? 8 : 7;
  if (/ultimate/.test(n)) return female ? 10 : male ? 9 : 10;
  return 99;
}

export function posterFor(name: string): string {
  const n = (name || '').toLowerCase();
  const male = isMale(n), female = isFemale(n);
  const img = (f: string) => '/img/' + f + '.webp';
  if (/starter/.test(n)) return img('poster-p1-starter');
  if (/standard/.test(n)) return img('poster-p2-standard');
  if (/extra/.test(n)) return img('poster-p3-extra');
  if (/supreme/.test(n)) return img('poster-p4-supreme');
  if (/beyond/.test(n)) return female ? img('poster-p6-beyond-f') : male ? img('poster-p5-beyond-m') : '';
  if (/signature/.test(n)) return female ? img('poster-p8-signature-f') : male ? img('poster-p7-signature-m') : '';
  if (/ultimate/.test(n)) return female ? img('poster-p10-ultimate-f') : male ? img('poster-p9-ultimate-m') : '';
  if (/allerg|ภูมิแพ้|ก่อภูมิ|ige/.test(n)) return img('poster-allergy');
  if (/hpv/.test(n)) return img('poster-hpv15');
  if (/14 โรค|realtime pcr|เชื้อ/.test(n)) return img('poster-std14');
  if (/เพศสัมพันธ์|std/.test(n)) return img('poster-std6');
  if (/tumor|มะเร็ง|บ่งชี้|plus|screen|คัดกรอง|พลัส/.test(n)) {
    const plus = /plus|พลัส/.test(n);
    if (female) return img(plus ? 'poster-tumor-plus-f' : 'poster-tumor-screen-f');
    if (male) return img(plus ? 'poster-tumor-plus-m' : 'poster-tumor-screen-m');
  }
  if (/marriage|ก่อนแต่ง|ก่อนสมรส|สมรส/.test(n)) {
    if (female) return img('poster-marriage-f');
    if (male) return img('poster-marriage-m');
  }
  if (/heart|vascular|หัวใจ|หลอดเลือด/.test(n)) return img('poster-heart-vascular');
  if (/thyroid|ไทรอยด/.test(n)) return /full|เต็ม|ครบ|990|5\s*รายการ/.test(n) ? img('poster-thyroid-full') : img('poster-thyroid-basic');
  return '';
}

// ---------- pricing ----------

export function travelFee(mode: 'lab' | 'home', distanceKm: number): number {
  if (mode === 'lab') return 0;
  const d = distanceKm;
  return PRICING.baseVisitFee + (d > PRICING.freeKm ? (d - PRICING.freeKm) * PRICING.perKmRate : 0);
}

/** What the browser sends per person: names only. Prices are looked up server-side. */
export interface PersonSelection { packages: string[]; tests: string[] }

export interface PricedItem { kind: 'package' | 'test'; name: string; price: number }
export interface PricedPerson { items: PricedItem[]; subtotal: number }

/** Prices each person's selection against a catalog. Unknown names are reported, not guessed. */
export function priceSelection(cat: Catalog, persons: PersonSelection[]) {
  const pk = packagePrices(cat.packages);
  const tests = new Map(cat.tests.map(t => [t.n, t.p]));
  const unknown: string[] = [];
  const priced: PricedPerson[] = persons.map(p => {
    const items: PricedItem[] = [];
    for (const name of p.packages) {
      const price = pk.get(name);
      if (price === undefined) unknown.push(name); else items.push({ kind: 'package', name, price });
    }
    for (const name of p.tests) {
      const price = tests.get(name);
      if (price === undefined) unknown.push(name); else items.push({ kind: 'test', name, price });
    }
    return { items, subtotal: items.reduce((a, i) => a + i.price, 0) };
  });
  return { priced, unknown, subtotal: priced.reduce((a, p) => a + p.subtotal, 0) };
}
