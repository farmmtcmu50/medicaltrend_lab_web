// POST /api/std/bookings — booking from the STD testing page (/std).
// Stored in the same bookings tables as the main site (source = 'std'), so it shows up in the Booking Console.
import { BRANCH_IDS, type BranchId } from '../shared/catalog';
import { STD_BOOKING_DAYS, branchHours, priceStd } from '../shared/std';
import { cleanRef } from '../shared/ref';
import { notifyBooking, type LineEnv } from './line';
import { addDays, bangkokToday, bookingRef, json } from './util';

type Env = LineEnv;

interface StdPayload {
  name?: string; email?: string; phone?: string; branch?: string;
  packages?: unknown; pathogens?: unknown;
  date?: string; time?: string; note?: string;
  pdpaConsent?: boolean; expectedTotal?: number; lang?: string; ref?: string;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function createStdBooking(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ error: 'json_required' }, 415);
  const p = await req.json<StdPayload>().catch(() => null);
  if (!p || typeof p !== 'object') return json({ error: 'bad_request', detail: 'payload' }, 400);

  const bad = (detail: string) => json({ error: 'bad_request', detail }, 400);
  const name = str(p.name, 120);
  const email = str(p.email, 160);
  const phone = str(p.phone, 20).replace(/[\s-]/g, '');
  if (!name) return bad('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email');
  if (!/^0\d{8,9}$/.test(phone)) return bad('phone');
  if (p.pdpaConsent !== true) return bad('pdpaConsent');
  if (!(BRANCH_IDS as readonly string[]).includes(p.branch || '')) return bad('branch');
  const branch = p.branch as BranchId;

  // Date and hourly slot must fall inside the branch's opening hours (Bangkok time).
  const date = str(p.date, 10), time = str(p.time, 5);
  const today = bangkokToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, STD_BOOKING_DAYS)) return bad('date');
  const hours = branchHours(branch, new Date(date + 'T00:00:00Z').getUTCDay());
  const hm = time.match(/^(\d{2}):00$/);
  const hour = hm ? +hm[1] : -1;
  if (!hours || hour < hours[0] || hour >= hours[1]) return json({ error: 'slot_unavailable' }, 409);
  const nowHour = new Date(Date.now() + 7 * 3600_000).getUTCHours();
  if (date === today && hour <= nowHour) return json({ error: 'slot_unavailable' }, 409);

  let priced: ReturnType<typeof priceStd>;
  try {
    const keys = Array.isArray(p.packages) ? p.packages.filter((k): k is string => typeof k === 'string').slice(0, 10) : [];
    const picks = Array.isArray(p.pathogens) ? p.pathogens.filter((i): i is number => typeof i === 'number').slice(0, 14) : [];
    priced = priceStd(keys, picks);
  } catch (e) {
    return bad('packages: ' + (e as Error).message);
  }
  if (Math.round(Number(p.expectedTotal)) !== priced.total) return json({ error: 'price_changed', total: priced.total }, 409);

  const id = crypto.randomUUID();
  const now = new Date();
  const ref = bookingRef(now);
  const note = str(p.note, 1000) || null;

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO bookings (
        id, ref, created_at, mode, branch, visit_date, slot, people, contact_name, contact_phone, contact_email, note,
        items_subtotal, travel_fee, total, price_source, pdpa_consent_at, lang, source, referrer
      ) VALUES (?1, ?2, ?3, 'lab', ?4, ?5, ?6, 1, ?7, ?8, ?9, ?10, ?11, 0, ?11, 'std', ?3, ?12, 'std', ?13)`)
      .bind(id, ref, now.toISOString(), branch, date, time, name, phone, email, note, priced.total, p.lang === 'en' ? 'en' : 'th', cleanRef(p.ref)),
    ...priced.lines.map(l =>
      env.DB.prepare("INSERT INTO booking_items (booking_id, person_no, kind, name, price) VALUES (?1, 1, 'package', ?2, ?3)")
        .bind(id, l.name, l.price)),
    env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, to_status) VALUES (?1, ?2, 'customer', 'created', 'pending')")
      .bind(id, now.toISOString()),
  ]);

  ctx.waitUntil(notifyBooking(env, id));
  return json({ ok: true, ref, total: priced.total }, 201);
}
