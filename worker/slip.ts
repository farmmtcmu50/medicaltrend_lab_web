// Customer appointment slip (/slip page): POST /api/slip {"ref": "MT-…", "phone": "08…"}.
// The booking reference and the phone number used to book must both match; a wrong pair and an unknown
// reference get the same answer. Only what the printed slip shows is returned.
import { json } from './util';

interface Env { DB: D1Database }

const REF_RE = /^MT-\d{6}-[2-9A-HJ-NP-Z]{4}$/;
/** Last 9 digits, so "081-234-5678", "0812345678" and "+66812345678" compare equal. */
const phoneKey = (v: string) => v.replace(/\D/g, '').slice(-9);

export async function slipResponse(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ ref?: unknown; phone?: unknown }>().catch(() => null);
  const ref = typeof body?.ref === 'string' ? body.ref.trim().toUpperCase() : '';
  const phone = typeof body?.phone === 'string' ? phoneKey(body.phone) : '';
  const notFound = () => json({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });
  if (!REF_RE.test(ref) || phone.length < 9) return notFound();

  const b = await env.DB.prepare(`SELECT id, ref, status, mode, branch, visit_date, slot, address, people, contact_name, contact_phone,
      lab_order_key FROM bookings WHERE ref = ?1`).bind(ref)
    .first<{ id: string; ref: string; status: string; mode: 'lab' | 'home'; branch: string | null; visit_date: string; slot: string;
      address: string | null; people: number; contact_name: string; contact_phone: string; lab_order_key: string | null }>();
  if (!b || phoneKey(b.contact_phone) !== phone) return notFound();

  const items = (await env.DB.prepare('SELECT person_no, kind, name FROM booking_items WHERE booking_id = ?1 ORDER BY person_no, id')
    .bind(b.id).all<{ person_no: number; kind: 'package' | 'test'; name: string }>()).results;
  return json({
    ref: b.ref, status: b.status, mode: b.mode, branch: b.branch, visit_date: b.visit_date, slot: b.slot, address: b.address,
    people: b.people, contact_name: b.contact_name, has_lab_order: !!b.lab_order_key, items,
  }, 200, { 'cache-control': 'no-store' });
}
