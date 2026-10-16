// STEP 3 packages, managed from the Booking Console.
//   GET  /api/admin/packages                      every package, shown and hidden, in display order
//                                                 (the first visit fills the list from the sheet's PAC-xx rows)
//   POST /api/admin/packages                      multipart: data (JSON) + optional poster → create / update
//   POST /api/admin/packages/import               add sheet PAC-xx rows that are not in the list yet
//   POST /api/admin/packages/order   {"ids":[…]}  new display order
//   POST /api/admin/packages/:id/active {"active":true|false}
//   POST /api/admin/packages/:id/delete
// Shown packages replace the sheet list in the catalog (loadCatalog), so the page and the booking API agree.
import type { PackageRow } from '../shared/admin';
import type { Catalog, PackageConfig, Pkg } from '../shared/catalog';
import { json } from './util';

interface Env { DB: D1Database; UPLOADS: R2Bucket }

const POSTER_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_POSTER = 5 * 1024 * 1024;
const CATALOG_KEY = 'https://catalog.internal/v2';

const toConfig = (r: PackageRow): PackageConfig => ({
  code: r.code, name: r.name, nameEn: r.name_en, detail: r.detail, detailEn: r.detail_en, price: r.price, poster: r.poster,
});

/** Shown packages in order, or null when none were ever set up (the page then lists the sheet's PAC-xx rows). */
export async function loadPackageConfig(env: Env): Promise<PackageConfig[] | null> {
  try {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM package_items').first<{ n: number }>();
    if (!n?.n) return null;
    const rows = (await env.DB.prepare('SELECT * FROM package_items WHERE active = 1 ORDER BY sort, updated_at').all<PackageRow>()).results;
    return rows.map(toConfig);
  } catch (e) {
    console.warn('package_items unavailable', e);
    return null;
  }
}

const int = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v)));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Adds sheet packages whose code is not in the list yet (shown, after the existing ones). Returns how many. */
async function importFromSheet(env: Env, pacs: Pkg[], email: string): Promise<number> {
  const have = (await env.DB.prepare('SELECT code, name FROM package_items').all<{ code: string | null; name: string }>()).results;
  const codes = new Set(have.map(r => (r.code || '').toUpperCase()));
  const names = new Set(have.map(r => r.name));
  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM package_items').first<{ m: number }>();
  let sort = max?.m ?? 0;
  const now = new Date().toISOString();
  const add = pacs.filter(p => p.id && !codes.has(p.id.toUpperCase()) && !names.has(p.name));
  if (!add.length) return 0;
  await env.DB.batch(add.map(p => env.DB.prepare(`INSERT INTO package_items (id, sort, active, code, name, name_en, detail, detail_en, price, poster,
      updated_at, updated_by) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, '', NULL, '', ?7, ?8)`)
    .bind(crypto.randomUUID(), ++sort, p.id!, p.name, p.name, p.detail, now, email)));
  return add.length;
}

/** Admin routes under /api/admin/packages (parts = path after /api/admin). */
export async function handlePackagesAdmin(
  req: Request, env: Env, email: string, parts: string[], ctx: { waitUntil: (p: Promise<unknown>) => void; catalog: () => Promise<Catalog> },
): Promise<Response> {
  const purge = () => ctx.waitUntil(caches.default.delete(new Request(CATALOG_KEY)).catch(() => false));
  const all = async () => (await env.DB.prepare('SELECT * FROM package_items ORDER BY sort, updated_at').all<PackageRow>()).results;

  if (req.method === 'GET' && parts.length === 1) {
    let items = await all();
    if (!items.length) {
      // First visit: start from the Master Price List, exactly what the page shows today.
      if (await importFromSheet(env, (await ctx.catalog()).pacs ?? [], 'sheet')) { purge(); items = await all(); }
    }
    return json({ items });
  }
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  const now = new Date().toISOString();

  if (parts.length === 1) return savePackage(req, env, email, now, purge);

  if (parts.length === 2 && parts[1] === 'import') {
    const added = await importFromSheet(env, (await ctx.catalog()).pacs ?? [], email);
    if (added) purge();
    return json({ items: await all(), added });
  }

  if (parts.length === 2 && parts[1] === 'order') {
    const body = await req.json<{ ids?: unknown }>().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string').slice(0, 300) : null;
    if (!ids) return json({ error: 'bad_request' }, 400);
    await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE package_items SET sort = ?1 WHERE id = ?2').bind(i + 1, id)));
    purge();
    return json({ items: await all() });
  }

  const id = parts[1] || '';
  const row = await env.DB.prepare('SELECT * FROM package_items WHERE id = ?1').bind(id).first<PackageRow>();
  if (!row) return json({ error: 'not_found' }, 404);

  if (parts.length === 3 && parts[2] === 'active') {
    const body = await req.json<{ active?: unknown }>().catch(() => null);
    if (typeof body?.active !== 'boolean') return json({ error: 'bad_request' }, 400);
    await env.DB.prepare('UPDATE package_items SET active = ?1, updated_at = ?2, updated_by = ?3 WHERE id = ?4')
      .bind(body.active ? 1 : 0, now, email, id).run();
    purge();
    return json({ items: await all() });
  }
  if (parts.length === 3 && parts[2] === 'delete') {
    await env.DB.prepare('DELETE FROM package_items WHERE id = ?1').bind(id).run();
    if (row.poster.startsWith('/api/posters/')) ctx.waitUntil(env.UPLOADS.delete('posters/' + row.poster.slice('/api/posters/'.length)));
    purge();
    return json({ items: await all() });
  }
  return json({ error: 'not_found' }, 404);
}

async function savePackage(req: Request, env: Env, email: string, now: string, purge: () => void): Promise<Response> {
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: 'bad_request', detail: 'multipart form expected' }, 400); }
  let d: Record<string, unknown>;
  try { d = JSON.parse(String(form.get('data') || '')); } catch { return json({ error: 'bad_request', detail: 'data' }, 400); }
  const bad = (detail: string) => json({ error: 'bad_request', detail }, 400);

  const id = typeof d.id === 'string' && d.id ? d.id : null;
  const existing = id ? await env.DB.prepare('SELECT * FROM package_items WHERE id = ?1').bind(id).first<PackageRow>() : null;
  if (id && !existing) return json({ error: 'not_found' }, 404);

  const name = text(d.name, 120);
  if (name.length < 2) return bad('name');
  const clash = await env.DB.prepare('SELECT id FROM package_items WHERE name = ?1 AND id != ?2').bind(name, id || '').first();
  if (clash) return bad('name_taken');
  const code = text(d.code, 20).replace(/\s+/g, '').toUpperCase() || null;
  const price = int(d.price);
  if (!code && (price === null || price <= 0 || price > 1_000_000)) return bad('price');
  if (price !== null && (price < 0 || price > 1_000_000)) return bad('price');

  let poster = existing?.poster || '';
  if (d.posterAuto === true && poster) {
    if (poster.startsWith('/api/posters/')) await env.UPLOADS.delete('posters/' + poster.slice('/api/posters/'.length));
    poster = '';
  }
  const file = form.get('poster');
  if (file instanceof File && file.size > 0) {
    const ext = POSTER_TYPES[file.type];
    if (!ext) return bad('poster_type');
    if (file.size > MAX_POSTER) return bad('poster_size');
    const fname = `${crypto.randomUUID()}.${ext}`;
    await env.UPLOADS.put('posters/' + fname, file.stream(), { httpMetadata: { contentType: file.type } });
    if (poster.startsWith('/api/posters/')) await env.UPLOADS.delete('posters/' + poster.slice('/api/posters/'.length));
    poster = '/api/posters/' + fname;
  }

  const vals = [code, name, text(d.nameEn, 120), text(d.detail, 400), text(d.detailEn, 400), code ? null : price, poster, now, email];
  if (existing) {
    await env.DB.prepare(`UPDATE package_items SET code = ?1, name = ?2, name_en = ?3, detail = ?4, detail_en = ?5, price = ?6, poster = ?7,
        updated_at = ?8, updated_by = ?9 WHERE id = ?10`).bind(...vals, existing.id).run();
  } else {
    const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM package_items').first<{ m: number }>();
    await env.DB.prepare(`INSERT INTO package_items (code, name, name_en, detail, detail_en, price, poster, updated_at, updated_by, id, sort, active)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(...vals, crypto.randomUUID(), (max?.m ?? 0) + 1, d.active === false ? 0 : 1).run();
  }
  purge();
  return json({ items: (await env.DB.prepare('SELECT * FROM package_items ORDER BY sort, updated_at').all<PackageRow>()).results });
}
