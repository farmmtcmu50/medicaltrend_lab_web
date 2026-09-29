// STEP 2 "popular" cards, managed from the Booking Console.
//   GET  /api/posters/:file                      public poster images stored in R2 (posters/…)
//   GET  /api/admin/popular                      every card, shown and hidden, in display order
//   POST /api/admin/popular                      multipart: data (JSON) + optional poster → create / update
//   POST /api/admin/popular/order   {"ids":[…]}  new display order
//   POST /api/admin/popular/:id/active {"active":true|false}
//   POST /api/admin/popular/:id/delete
// Shown cards join the catalog (loadCatalog), so the page and the booking API price them identically.
import type { PopularRow } from '../shared/admin';
import type { Popular, PopularTier } from '../shared/catalog';
import { json } from './util';

interface Env { DB: D1Database; UPLOADS: R2Bucket }

const POSTER_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_POSTER = 5 * 1024 * 1024;
const CATALOG_KEY = 'https://catalog.internal/v1';

export const toPopular = (r: PopularRow): Popular => ({
  id: r.id, name: r.name, nameEn: r.name_en || r.name, detail: r.detail, detailEn: r.detail_en || r.detail,
  price: r.price ?? undefined, was: r.was ?? undefined, poster: r.poster, stdLink: !!r.std_link,
  code: r.code ?? undefined,
  tiers: r.tiers_json ? (JSON.parse(r.tiers_json) as PopularTier[]) : undefined,
});

/** Shown cards in order, or null if the table is not there yet (then the built-in POPULAR list is used). */
export async function loadPopular(env: Env): Promise<Popular[] | null> {
  try {
    const rows = (await env.DB.prepare('SELECT * FROM popular_items WHERE active = 1 ORDER BY sort, updated_at').all<PopularRow>()).results;
    return rows.map(toPopular);
  } catch (e) {
    console.warn('popular_items unavailable', e);
    return null;
  }
}

export async function servePoster(file: string, env: Env): Promise<Response> {
  if (!/^[\w-]+\.(webp|jpg|png)$/.test(file)) return json({ error: 'not_found' }, 404);
  const obj = await env.UPLOADS.get('posters/' + file);
  if (!obj) return json({ error: 'not_found' }, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable', // every upload gets a new file name
      'x-content-type-options': 'nosniff',
    },
  });
}

const int = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v)));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Admin routes under /api/admin/popular (parts = path after /api/admin). */
export async function handlePopularAdmin(req: Request, env: Env, email: string, parts: string[], waitUntil: (p: Promise<unknown>) => void): Promise<Response> {
  const purge = () => waitUntil(caches.default.delete(new Request(CATALOG_KEY)).catch(() => false));
  const all = async () => (await env.DB.prepare('SELECT * FROM popular_items ORDER BY sort, updated_at').all<PopularRow>()).results;

  if (req.method === 'GET' && parts.length === 1) return json({ items: await all() });
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  const now = new Date().toISOString();

  if (parts.length === 1) return savePopular(req, env, email, now, purge);

  if (parts.length === 2 && parts[1] === 'order') {
    const body = await req.json<{ ids?: unknown }>().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string').slice(0, 200) : null;
    if (!ids) return json({ error: 'bad_request' }, 400);
    await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE popular_items SET sort = ?1 WHERE id = ?2').bind(i + 1, id)));
    purge();
    return json({ items: await all() });
  }

  const id = parts[1] || '';
  const row = await env.DB.prepare('SELECT * FROM popular_items WHERE id = ?1').bind(id).first<PopularRow>();
  if (!row) return json({ error: 'not_found' }, 404);

  if (parts.length === 3 && parts[2] === 'active') {
    const body = await req.json<{ active?: unknown }>().catch(() => null);
    if (typeof body?.active !== 'boolean') return json({ error: 'bad_request' }, 400);
    await env.DB.prepare('UPDATE popular_items SET active = ?1, updated_at = ?2, updated_by = ?3 WHERE id = ?4')
      .bind(body.active ? 1 : 0, now, email, id).run();
    purge();
    return json({ items: await all() });
  }
  if (parts.length === 3 && parts[2] === 'delete') {
    await env.DB.prepare('DELETE FROM popular_items WHERE id = ?1').bind(id).run();
    if (row.poster.startsWith('/api/posters/')) waitUntil(env.UPLOADS.delete('posters/' + row.poster.slice('/api/posters/'.length)));
    purge();
    return json({ items: await all() });
  }
  return json({ error: 'not_found' }, 404);
}

async function savePopular(req: Request, env: Env, email: string, now: string, purge: () => void): Promise<Response> {
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: 'bad_request', detail: 'multipart form expected' }, 400); }
  let d: Record<string, unknown>;
  try { d = JSON.parse(String(form.get('data') || '')); } catch { return json({ error: 'bad_request', detail: 'data' }, 400); }
  const bad = (detail: string) => json({ error: 'bad_request', detail }, 400);

  const id = typeof d.id === 'string' && d.id ? d.id : null;
  const existing = id ? await env.DB.prepare('SELECT * FROM popular_items WHERE id = ?1').bind(id).first<PopularRow>() : null;
  if (id && !existing) return json({ error: 'not_found' }, 404);

  const name = text(d.name, 120);
  if (name.length < 2) return bad('name');
  const clash = await env.DB.prepare('SELECT id FROM popular_items WHERE name = ?1 AND id != ?2').bind(name, id || '').first();
  if (clash) return bad('name_taken');

  const tiers: PopularTier[] = [];
  if (Array.isArray(d.tiers)) {
    for (const t of d.tiers.slice(0, 8) as { label?: unknown; price?: unknown }[]) {
      const label = text(t?.label, 40), price = int(t?.price);
      if (!label || price === null || !(price >= 0 && price <= 1_000_000)) return bad('tiers');
      tiers.push({ label, price });
    }
  }
  const code = text(d.code, 20).toUpperCase() || null;
  const price = int(d.price);
  const was = int(d.was);
  if (!tiers.length && !code && (price === null || price < 0 || price > 1_000_000)) return bad('price');
  if (was !== null && (was < 0 || was > 1_000_000)) return bad('was');

  let poster = existing?.poster || '';
  const file = form.get('poster');
  if (file instanceof File && file.size > 0) {
    const ext = POSTER_TYPES[file.type];
    if (!ext) return bad('poster_type');
    if (file.size > MAX_POSTER) return bad('poster_size');
    const fname = `${crypto.randomUUID()}.${ext}`;
    await env.UPLOADS.put('posters/' + fname, file.stream(), { httpMetadata: { contentType: file.type } });
    if (existing?.poster.startsWith('/api/posters/')) await env.UPLOADS.delete('posters/' + existing.poster.slice('/api/posters/'.length));
    poster = '/api/posters/' + fname;
  }
  if (!poster) return bad('poster');

  const vals = [
    name, text(d.nameEn, 120) || name, text(d.detail, 400), text(d.detailEn, 400) || text(d.detail, 400),
    tiers.length ? null : price, was, tiers.length ? JSON.stringify(tiers) : null, code, poster,
    d.stdLink === true ? 1 : 0, now, email,
  ];
  if (existing) {
    await env.DB.prepare(`UPDATE popular_items SET name = ?1, name_en = ?2, detail = ?3, detail_en = ?4, price = ?5, was = ?6,
        tiers_json = ?7, code = ?8, poster = ?9, std_link = ?10, updated_at = ?11, updated_by = ?12 WHERE id = ?13`)
      .bind(...vals, existing.id).run();
  } else {
    const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM popular_items').first<{ m: number }>();
    await env.DB.prepare(`INSERT INTO popular_items (name, name_en, detail, detail_en, price, was, tiers_json, code, poster, std_link,
        updated_at, updated_by, id, sort, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
      .bind(...vals, crypto.randomUUID(), (max?.m ?? 0) + 1, d.active === false ? 0 : 1).run();
  }
  purge();
  return json({ items: (await env.DB.prepare('SELECT * FROM popular_items ORDER BY sort, updated_at').all<PopularRow>()).results });
}
