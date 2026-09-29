// Back-office API. Every handler here runs only after authenticateAdmin() succeeded.
//   GET  /api/admin/me
//   GET  /api/admin/summary
//   GET  /api/admin/bookings?status=&branch=&q=&from=&to=&page=
//   GET  /api/admin/bookings/:ref
//   POST /api/admin/bookings/:ref/status   {"status": "..."}
//   POST /api/admin/bookings/:ref/note     {"note": "..."}
//   POST /api/admin/bookings/:ref/items    {"persons": [[{kind, name}]], "expectedUpdatedAt": "..."} re-price + LINE alert
//   GET  /api/admin/bookings/:ref/lab-order
import { BRANCH_IDS, type Catalog } from '../shared/catalog';
import { STATUSES, type AdminBooking, type AdminRow, type AdminSummary, type Status } from '../shared/admin';
import { MAX_ITEMS_PER_PERSON, MAX_PERSONS, describeEdit, priceBook, priceEdit, type EditItem, type StoredItem } from '../shared/itemEdit';
import { notifyItemsChanged, type LineEnv } from './line';

interface Env extends LineEnv { UPLOADS: R2Bucket }
export interface AdminCtx { waitUntil: (p: Promise<unknown>) => void; catalog: () => Promise<Catalog> }

const PAGE_SIZE = 50;
const REF_RE = /^MT-\d{6}-[2-9A-HJ-NP-Z]{4}$/;

export async function handleAdmin(req: Request, env: Env, email: string, ctx: AdminCtx): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);

  if (req.method === 'POST') {
    // JSON-only + same-origin: blocks cross-site form posts riding on the Access cookie.
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'bad_origin' }, 403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ error: 'json_required' }, 415);
  }

  if (req.method === 'GET' && parts.length === 1 && parts[0] === 'me') return json({ email });
  if (req.method === 'GET' && parts.length === 1 && parts[0] === 'summary') return json(await summary(env));
  if (parts[0] !== 'bookings') return json({ error: 'not_found' }, 404);

  if (req.method === 'GET' && parts.length === 1) return listBookings(url, env);

  const ref = parts[1] || '';
  if (!REF_RE.test(ref)) return json({ error: 'not_found' }, 404);
  const row = await env.DB.prepare('SELECT id, status, lab_order_key, lab_order_name FROM bookings WHERE ref = ?1')
    .bind(ref).first<{ id: string; status: Status; lab_order_key: string | null; lab_order_name: string | null }>();
  if (!row) return json({ error: 'not_found' }, 404);

  if (req.method === 'GET' && parts.length === 2) return json(await bookingDetail(env, ref));

  if (req.method === 'GET' && parts[2] === 'lab-order' && parts.length === 3) {
    if (!row.lab_order_key) return json({ error: 'not_found' }, 404);
    const obj = await env.UPLOADS.get(row.lab_order_key);
    if (!obj) return json({ error: 'not_found' }, 404);
    const name = (row.lab_order_name || 'lab-order').replace(/[^\w.\-]+/g, '_');
    return new Response(obj.body, {
      headers: {
        'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'content-disposition': `inline; filename="${ref}-${name}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  if (req.method === 'POST' && parts.length === 3 && parts[2] === 'items') return editItems(req, env, email, ctx, ref, row.id);

  if (req.method === 'POST' && parts.length === 3 && (parts[2] === 'status' || parts[2] === 'note')) {
    const body = await req.json<{ status?: string; note?: string }>().catch(() => null);
    if (!body) return json({ error: 'bad_request' }, 400);
    const now = new Date().toISOString();

    if (parts[2] === 'status') {
      const to = body.status as Status;
      if (!(STATUSES as readonly string[]).includes(to)) return json({ error: 'bad_request', detail: 'status' }, 400);
      if (to === row.status) return json(await bookingDetail(env, ref));
      await env.DB.batch([
        env.DB.prepare('UPDATE bookings SET status = ?1, updated_at = ?2 WHERE id = ?3').bind(to, now, row.id),
        env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, from_status, to_status) VALUES (?1, ?2, ?3, 'status', ?4, ?5)")
          .bind(row.id, now, email, row.status, to),
      ]);
    } else {
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : null;
      if (note === null) return json({ error: 'bad_request', detail: 'note' }, 400);
      await env.DB.batch([
        env.DB.prepare('UPDATE bookings SET staff_note = ?1, updated_at = ?2 WHERE id = ?3').bind(note || null, now, row.id),
        env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, note) VALUES (?1, ?2, ?3, 'note', ?4)")
          .bind(row.id, now, email, note),
      ]);
    }
    return json(await bookingDetail(env, ref));
  }

  return json({ error: 'not_found' }, 404);
}

async function editItems(req: Request, env: Env, email: string, ctx: AdminCtx, ref: string, id: string) {
  const body = await req.json<{ persons?: unknown; expectedUpdatedAt?: unknown }>().catch(() => null);
  const bad = (detail: string) => json({ error: 'bad_request', detail }, 400);
  if (!body || !Array.isArray(body.persons)) return bad('persons');
  if (body.persons.length < 1 || body.persons.length > MAX_PERSONS) return bad('persons');
  const persons: EditItem[][] = [];
  for (const p of body.persons) {
    if (!Array.isArray(p) || p.length > MAX_ITEMS_PER_PERSON) return bad('items');
    const items: EditItem[] = [];
    for (const it of p as { kind?: unknown; name?: unknown }[]) {
      if ((it?.kind !== 'package' && it?.kind !== 'test') || typeof it.name !== 'string' || !it.name || it.name.length > 200) return bad('item');
      if (!items.some(x => x.kind === it.kind && x.name === it.name)) items.push({ kind: it.kind, name: it.name });
    }
    persons.push(items);
  }

  const b = await env.DB.prepare('SELECT status, total, travel_fee, updated_at FROM bookings WHERE id = ?1')
    .bind(id).first<{ status: Status; total: number; travel_fee: number; updated_at: string | null }>();
  if (!b) return json({ error: 'not_found' }, 404);
  if (b.status === 'cancelled') return json({ error: 'booking_cancelled' }, 409);
  // Someone else saved this booking since the editor was opened.
  if ((body.expectedUpdatedAt ?? null) !== b.updated_at) return json({ error: 'conflict' }, 409);

  const existing = (await env.DB.prepare('SELECT person_no, kind, name, price FROM booking_items WHERE booking_id = ?1 ORDER BY person_no, id')
    .bind(id).all<StoredItem>()).results;
  const edit = priceEdit(existing, persons, priceBook(await ctx.catalog()));
  if (edit.unknown.length) return json({ error: 'unknown_items', items: edit.unknown }, 409);
  if (!edit.added.length && !edit.removed.length && persons.length === existing.reduce((m, x) => Math.max(m, x.person_no), 0)) {
    return json(await bookingDetail(env, ref));
  }

  const total = edit.subtotal + b.travel_fee;
  const now = new Date().toISOString();
  const summary = describeEdit(edit, b.total, total);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM booking_items WHERE booking_id = ?1').bind(id),
    ...edit.persons.flatMap(p => p.items.map(it =>
      env.DB.prepare('INSERT INTO booking_items (booking_id, person_no, kind, name, price) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(id, it.person_no, it.kind, it.name, it.price))),
    env.DB.prepare('UPDATE bookings SET items_subtotal = ?1, total = ?2, people = ?3, updated_at = ?4 WHERE id = ?5')
      .bind(edit.subtotal, total, persons.length, now, id),
    env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, note) VALUES (?1, ?2, ?3, 'items', ?4)")
      .bind(id, now, email, summary),
  ]);
  ctx.waitUntil(notifyItemsChanged(env, id, email, edit, b.total));
  return json(await bookingDetail(env, ref));
}

async function listBookings(url: URL, env: Env) {
  const p = url.searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replace('?', '?' + args.length)); };

  const status = p.get('status');
  if (status && (STATUSES as readonly string[]).includes(status)) add('status = ?', status);
  const source = p.get('source');
  if (source === 'web' || source === 'std') add('source = ?', source);
  const branch = p.get('branch');
  if (branch === 'home') where.push("mode = 'home'");
  else if (branch && (BRANCH_IDS as readonly string[]).includes(branch)) { where.push("mode = 'lab'"); add('branch = ?', branch); }
  const from = p.get('from'), to = p.get('to');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add('visit_date >= ?', from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add('visit_date <= ?', to);
  const q = (p.get('q') || '').trim().slice(0, 80);
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%';
    args.push(like, like, like);
    const n = args.length;
    where.push(`(ref LIKE ?${n - 2} ESCAPE '\\' OR contact_name LIKE ?${n - 1} ESCAPE '\\' OR contact_phone LIKE ?${n} ESCAPE '\\')`);
  }
  const page = Math.max(1, Math.min(1000, Number(p.get('page')) || 1));
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT ref, created_at, status, mode, branch, visit_date, slot, people, contact_name, contact_phone, total, source,
        (lab_order_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id = bookings.id)) AS rx_pending
      FROM bookings ${w} ORDER BY visit_date DESC, slot ASC, created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`).bind(...args),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM bookings ${w}`).bind(...args),
  ]);
  const total = (count.results[0] as { n: number }).n;
  return json({ rows: rows.results as unknown as AdminRow[], total, page, pageSize: PAGE_SIZE });
}

async function bookingDetail(env: Env, ref: string): Promise<AdminBooking> {
  const b = await env.DB.prepare(`SELECT id, ref, created_at, status, mode, branch, visit_date, slot, address, latitude, longitude,
      patient_type, distance_km, people, contact_name, contact_phone, contact_line, contact_email, note, lab_order_key,
      lab_order_name, items_subtotal, travel_fee, total, price_source, pdpa_consent_at, lang, staff_note, updated_at, map_url, source, referrer
      FROM bookings WHERE ref = ?1`).bind(ref).first<Record<string, unknown>>();
  const [items, events] = await env.DB.batch([
    env.DB.prepare('SELECT person_no, kind, name, price FROM booking_items WHERE booking_id = ?1 ORDER BY person_no, id').bind(b!.id),
    env.DB.prepare('SELECT at, actor, action, from_status, to_status, note FROM booking_events WHERE booking_id = ?1 ORDER BY at, id').bind(b!.id),
  ]);
  const { id: _id, lab_order_key, ...rest } = b!;
  return {
    ...(rest as unknown as AdminBooking),
    has_lab_order: !!lab_order_key,
    items: items.results as unknown as AdminBooking['items'],
    events: events.results as unknown as AdminBooking['events'],
  };
}

async function summary(env: Env): Promise<AdminSummary> {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  // created_at is UTC; shift to Bangkok before taking the date.
  const bkkDate = "substr(datetime(created_at, '+7 hours'), 1, 10)";
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [visits, created, pending, rev, byStatus, byBranch, top, refs] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n, SUM(mode = 'home') AS h FROM bookings WHERE visit_date = ?1 AND status != 'cancelled'").bind(today),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE ${bkkDate} = ?1`).bind(today),
    env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'"),
    env.DB.prepare("SELECT COALESCE(SUM(total), 0) AS s, COUNT(*) AS n FROM bookings WHERE substr(visit_date, 1, 7) = ?1 AND status != 'cancelled'").bind(month),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM bookings WHERE visit_date = ?1 GROUP BY status').bind(today),
    env.DB.prepare(`SELECT CASE WHEN mode = 'home' THEN 'home' ELSE branch END AS k, SUM(total) AS s, COUNT(*) AS n
      FROM bookings WHERE substr(visit_date, 1, 7) = ?1 AND status != 'cancelled' GROUP BY k ORDER BY s DESC`).bind(month),
    env.DB.prepare(`SELECT i.name, COUNT(*) AS n, SUM(i.price) AS s FROM booking_items i JOIN bookings b ON b.id = i.booking_id
      WHERE b.status != 'cancelled' AND b.created_at >= ?1 GROUP BY i.name ORDER BY n DESC, s DESC LIMIT 5`)
      .bind(since30),
    env.DB.prepare(`SELECT source, referrer, COUNT(*) AS n, SUM(total) AS s FROM bookings
      WHERE created_at >= ?1 AND status != 'cancelled' GROUP BY source, referrer ORDER BY n DESC LIMIT 12`).bind(since30),
  ]);
  const first = <T>(r: D1Result) => r.results[0] as T;
  return {
    today,
    visitsToday: first<{ n: number }>(visits).n,
    homeVisitsToday: first<{ h: number | null }>(visits).h || 0,
    newToday: first<{ n: number }>(created).n,
    pending: first<{ n: number }>(pending).n,
    monthRevenue: first<{ s: number }>(rev).s,
    monthBookings: first<{ n: number }>(rev).n,
    statusToday: Object.fromEntries((byStatus.results as { status: string; n: number }[]).map(r => [r.status, r.n])),
    revenueByBranch: (byBranch.results as { k: string; s: number; n: number }[]).map(r => ({ key: r.k, amount: r.s, count: r.n })),
    topItems: (top.results as { name: string; n: number; s: number }[]).map(r => ({ name: r.name, count: r.n, amount: r.s })),
    referrers: (refs.results as { source: string; referrer: string | null; n: number; s: number }[]).map(r => ({ source: r.source, referrer: r.referrer, count: r.n, amount: r.s || 0 })),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}
