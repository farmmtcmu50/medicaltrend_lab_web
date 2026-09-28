// Cloudflare Worker for lab.medicaltrend.stream
//   GET  /api/catalog   retail price list (Google Sheet -> edge cache -> D1 copy -> bundled snapshot)
//   POST /api/bookings  multipart booking + optional doctor's lab order -> R2 + D1
//   /admin, /api/admin/* back office, behind Cloudflare Access (see worker/access.ts, worker/admin.ts)
// Every other path is served straight from static assets (see wrangler.jsonc).
import {
  BRANCH_IDS, PATIENT_TYPES, PRICING, SHEET_ID, SHEET_TAB, SLOTS,
  buildCatalog, parseSheet, priceSelection, snapshotCatalog, travelFee,
  type Catalog, type PersonSelection, type Test,
} from '../shared/catalog';

import { authenticateAdmin, type AccessEnv } from './access';
import { handleAdmin } from './admin';

export interface Env extends AccessEnv {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ASSETS: Fetcher;
}

const CATALOG_TTL_S = 60;              // sheet edits show up within a minute
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/catalog' && req.method === 'GET') return await catalogResponse(env, ctx);
      if (url.pathname === '/api/bookings' && req.method === 'POST') return await createBooking(req, env, ctx);
      if (url.pathname.startsWith('/api/admin') || isAdminPage(url.pathname)) {
        const auth = await authenticateAdmin(req, env);
        if (!auth.ok) {
          if (!isAdminPage(url.pathname)) return json({ error: auth.reason }, auth.status);
          const msg = auth.detectedAud
            ? 'ล็อกอินผ่าน Cloudflare Access สำเร็จ แต่ยังไม่ได้ใส่ AUD Tag ใน wrangler.jsonc\n\n' +
              'AUD Tag ของแอปนี้คือ:\n\n' + auth.detectedAud + '\n\n' +
              'คัดลอกค่านี้ไปใส่ที่ "ACCESS_AUD" ใน wrangler.jsonc แล้วรัน npm run deploy อีกครั้ง'
            : 'ไม่มีสิทธิ์เข้าหน้านี้ (' + auth.reason + ')';
          return new Response(msg, { status: auth.status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
        }
        if (url.pathname.startsWith('/api/admin')) return await handleAdmin(req, env, auth.email);
        const page = await env.ASSETS.fetch(new Request(new URL('/admin', url), req));
        const res = new Response(page.body, page);
        res.headers.set('cache-control', 'private, no-store');
        res.headers.set('x-robots-tag', 'noindex');
        return res;
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
      return env.ASSETS.fetch(req);
    } catch (err) {
      console.error('unhandled', err);
      return json({ error: 'server_error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

const isAdminPage = (path: string) => path === '/admin' || path.startsWith('/admin/') || path === '/admin.html';

// ---------------------------------------------------------------- catalog

async function loadCatalog(env: Env, ctx: ExecutionContext): Promise<Catalog> {
  const cache = caches.default;
  const key = new Request('https://catalog.internal/v1');
  const hit = await cache.match(key);
  if (hit) return hit.json();

  let cat: Catalog;
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`,
      { redirect: 'follow' },
    );
    if (!res.ok) throw new Error('sheet http ' + res.status);
    const rows = parseSheet(await res.text());
    const now = new Date().toISOString();
    cat = buildCatalog(rows, 'live', now);
    ctx.waitUntil(env.DB.prepare(
      'INSERT INTO catalog_cache (id, rows_json, synced_at) VALUES (1, ?1, ?2) ' +
      'ON CONFLICT (id) DO UPDATE SET rows_json = excluded.rows_json, synced_at = excluded.synced_at',
    ).bind(JSON.stringify(rows), now).run().catch(e => console.error('catalog_cache write', e)));
  } catch (err) {
    console.warn('sheet unavailable, falling back', err);
    const row = await env.DB.prepare('SELECT rows_json, synced_at FROM catalog_cache WHERE id = 1')
      .first<{ rows_json: string; synced_at: string }>().catch(() => null);
    cat = row ? buildCatalog(JSON.parse(row.rows_json) as Test[], 'cache', row.synced_at) : snapshotCatalog();
  }

  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(cat), {
    headers: { 'content-type': 'application/json', 'cache-control': `max-age=${cat.source === 'live' ? CATALOG_TTL_S : 15}` },
  })));
  return cat;
}

async function catalogResponse(env: Env, ctx: ExecutionContext) {
  const cat = await loadCatalog(env, ctx);
  return json(cat, 200, { 'cache-control': `public, max-age=${CATALOG_TTL_S}` });
}

// ---------------------------------------------------------------- bookings

interface BookingPayload {
  mode: 'lab' | 'home';
  branch?: string;
  visitDate: string;
  slot: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  patientType?: string;
  distanceKm?: number;
  persons: PersonSelection[];
  contact: { name: string; phone: string; line?: string; email?: string; note?: string };
  pdpaConsent: boolean;
  expectedTotal: number;
  lang?: string;
}

class BadRequest extends Error {}
const need = (ok: unknown, msg: string) => { if (!ok) throw new BadRequest(msg); };
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function createBooking(req: Request, env: Env, ctx: ExecutionContext) {
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: 'bad_request', detail: 'multipart form expected' }, 400); }

  let p: BookingPayload;
  try { p = JSON.parse(String(form.get('payload') || '')); } catch { return json({ error: 'bad_request', detail: 'payload' }, 400); }

  const file = form.get('labOrder');
  const upload = file instanceof File && file.size > 0 ? file : null;

  let v: ReturnType<typeof validate>;
  try {
    v = validate(p, upload);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: 'bad_request', detail: e.message }, 400);
    throw e;
  }

  const cat = await loadCatalog(env, ctx);
  const { priced, unknown, subtotal } = priceSelection(cat, p.persons);
  if (unknown.length) return json({ error: 'catalog_changed', unknown }, 409);
  const travel = travelFee(p.mode, v.distanceKm ?? 0);
  const total = subtotal + travel;
  if (total !== Math.round(Number(p.expectedTotal))) return json({ error: 'price_changed', total }, 409);

  const id = crypto.randomUUID();
  const now = new Date();
  const ref = bookingRef(now);

  let labOrderKey: string | null = null;
  if (upload) {
    const ext = UPLOAD_TYPES[upload.type];
    labOrderKey = `lab-orders/${now.toISOString().slice(0, 7)}/${id}.${ext}`;
    await env.UPLOADS.put(labOrderKey, upload.stream(), {
      httpMetadata: { contentType: upload.type },
      customMetadata: { bookingRef: ref, originalName: upload.name.slice(0, 200) },
    });
  }

  const stmts = [
    env.DB.prepare(`INSERT INTO bookings (
        id, ref, created_at, mode, branch, visit_date, slot, address, latitude, longitude, patient_type,
        distance_km, people, contact_name, contact_phone, contact_line, contact_email, note,
        lab_order_key, lab_order_name, items_subtotal, travel_fee, total, price_source, pdpa_consent_at, lang
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)`)
      .bind(
        id, ref, now.toISOString(), p.mode, v.branch, p.visitDate, p.slot, v.address, v.lat, v.lng, v.patientType,
        v.distanceKm, p.persons.length, v.name, v.phone, v.line, v.email, v.note,
        labOrderKey, upload ? upload.name.slice(0, 200) : null, subtotal, travel, total, cat.source,
        now.toISOString(), p.lang === 'en' ? 'en' : 'th',
      ),
    ...priced.flatMap((person, i) => person.items.map(it =>
      env.DB.prepare('INSERT INTO booking_items (booking_id, person_no, kind, name, price) VALUES (?1,?2,?3,?4,?5)')
        .bind(id, i + 1, it.kind, it.name, it.price))),
    env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, to_status) VALUES (?1, ?2, 'customer', 'created', 'pending')")
      .bind(id, now.toISOString()),
  ];

  try {
    await env.DB.batch(stmts);
  } catch (err) {
    if (labOrderKey) ctx.waitUntil(env.UPLOADS.delete(labOrderKey));
    throw err;
  }

  return json({ ok: true, ref, total, travelFee: travel, subtotal }, 201);
}

function validate(p: BookingPayload, upload: File | null) {
  need(p && typeof p === 'object', 'payload');
  need(p.mode === 'lab' || p.mode === 'home', 'mode');
  need((SLOTS as readonly string[]).includes(p.slot), 'slot');
  need(/^\d{4}-\d{2}-\d{2}$/.test(p.visitDate || ''), 'visitDate');
  const today = bangkokToday();
  const last = addDays(today, 90);
  need(p.visitDate >= today && p.visitDate <= last, 'visitDate out of range');

  need(Array.isArray(p.persons) && p.persons.length >= 1 && p.persons.length <= PRICING.maxPeople, 'persons');
  for (const person of p.persons) {
    need(person && Array.isArray(person.packages) && Array.isArray(person.tests), 'persons');
    need(person.packages.length + person.tests.length > 0, 'every person needs at least one item');
    need(person.packages.length + person.tests.length <= 60, 'too many items');
    need([...person.packages, ...person.tests].every(x => typeof x === 'string' && x.length <= 200), 'item');
  }

  const c = p.contact || ({} as BookingPayload['contact']);
  const name = str(c.name, 120);
  const phone = str(c.phone, 30).replace(/[^\d+]/g, '');
  const email = str(c.email, 160);
  need(name.length >= 2, 'contact.name');
  need(/^(\+66|0)\d{8,9}$/.test(phone), 'contact.phone');
  need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'contact.email');
  need(p.pdpaConsent === true, 'pdpaConsent');

  let branch: string | null = null, address: string | null = null, patientType: string | null = null;
  let distanceKm: number | null = null, lat: number | null = null, lng: number | null = null;
  if (p.mode === 'lab') {
    need((BRANCH_IDS as readonly string[]).includes(p.branch || ''), 'branch');
    branch = p.branch!;
  } else {
    address = str(p.address, 500);
    need(address.length >= 5, 'address');
    need((PATIENT_TYPES as readonly string[]).includes(p.patientType || ''), 'patientType');
    patientType = p.patientType!;
    distanceKm = Math.round(Number(p.distanceKm));
    need(distanceKm >= PRICING.minKm && distanceKm <= PRICING.maxKm, 'distanceKm');
    if (typeof p.lat === 'number' && typeof p.lng === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180) {
      lat = p.lat; lng = p.lng;
    }
  }

  if (upload) {
    need(upload.size <= MAX_UPLOAD_BYTES, 'labOrder too large');
    need(UPLOAD_TYPES[upload.type], 'labOrder type');
  }

  return {
    name, phone, email: email || null,
    line: str(c.line, 80) || null, note: str(c.note, 1000) || null,
    branch, address, patientType, distanceKm, lat, lng,
  };
}

// ---------------------------------------------------------------- helpers

function bangkokToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** MT-YYMMDD-XXXX with an unambiguous alphabet (no 0/O/1/I). */
function bookingRef(now: Date): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const tail = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  const bkk = new Date(now.getTime() + 7 * 3600_000).toISOString();
  return `MT-${bkk.slice(2, 4)}${bkk.slice(5, 7)}${bkk.slice(8, 10)}-${tail}`;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...(status >= 400 || !headers['cache-control'] ? { 'cache-control': 'no-store' } : {}),
      ...headers,
    },
  });
}
