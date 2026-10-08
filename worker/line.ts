// LINE booking alerts to the staff group, through the Messaging API of the company's LINE OA.
//   POST /api/line/webhook  receives LINE events. Staff bind a group by typing
//                           "ผูกแจ้งเตือน <LINE_BIND_CODE>" in it (the OA is public, so joining alone is not enough).
//   notifyBooking()         pushes a summary of a new booking to the bound group; failures never affect the booking.
//   notifyItemsChanged()    pushes what staff changed in a booking's tests from the Booking Console.
// Secrets (wrangler secret put): LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_BIND_CODE.
// Optional var LINE_GROUP_ID overrides the group bound through the webhook.
import { BRANCH_NAMES, PATIENT_LABELS } from '../shared/admin';
import type { PricedEdit } from '../shared/itemEdit';
import { refLabel } from '../shared/ref';
import { json } from './util';

export interface LineEnv {
  DB: D1Database;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_BIND_CODE?: string;
  LINE_GROUP_ID?: string;
}

const GROUP_KEY = 'line_group_id';
const SITE = 'https://lab.medicaltrend.stream';

// ---------------------------------------------------------------- webhook

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; groupId?: string };
  message?: { type: string; text?: string };
}

export async function handleLineWebhook(req: Request, env: LineEnv): Promise<Response> {
  if (!env.LINE_CHANNEL_SECRET) return json({ error: 'line_not_configured' }, 503);
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get('x-line-signature') || '', env.LINE_CHANNEL_SECRET))) {
    return json({ error: 'bad_signature' }, 401);
  }
  const events = (JSON.parse(body || '{}') as { events?: LineEvent[] }).events || [];
  for (const ev of events) {
    const groupId = ev.source?.type === 'group' ? ev.source.groupId : undefined;
    if (!groupId) continue;                       // 1:1 chats with customers are ignored
    const bound = await boundGroup(env);
    if (ev.type === 'leave' && groupId === bound) {
      await env.DB.prepare('DELETE FROM app_settings WHERE key = ?1').bind(GROUP_KEY).run();
      continue;
    }
    if (ev.type !== 'message' || ev.message?.type !== 'text' || !ev.replyToken) continue;
    const text = (ev.message.text || '').trim();
    const code = env.LINE_BIND_CODE?.trim();
    if (code && text === 'ผูกแจ้งเตือน ' + code) {
      await env.DB.prepare(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
        'ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      ).bind(GROUP_KEY, groupId, new Date().toISOString()).run();
      await reply(env, ev.replyToken, '✅ เชื่อมกลุ่มนี้กับระบบจองแล้ว\nการจองใหม่จาก lab.medicaltrend.stream จะแจ้งเตือนในกลุ่มนี้');
    } else if (code && text === 'ยกเลิกแจ้งเตือน ' + code && groupId === bound) {
      await env.DB.prepare('DELETE FROM app_settings WHERE key = ?1').bind(GROUP_KEY).run();
      await reply(env, ev.replyToken, 'ยกเลิกการแจ้งเตือนการจองในกลุ่มนี้แล้ว');
    } else if (text === 'สถานะแจ้งเตือน' && groupId === bound) {
      await reply(env, ev.replyToken, '✅ กลุ่มนี้รับแจ้งเตือนการจองอยู่');
    }
  }
  return json({ ok: true });
}

async function validSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  let sig: Uint8Array;
  try {
    sig = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(body));
}

async function boundGroup(env: LineEnv): Promise<string | null> {
  if (env.LINE_GROUP_ID) return env.LINE_GROUP_ID;
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?1').bind(GROUP_KEY).first<{ value: string }>();
  return row?.value ?? null;
}

async function lineApi(env: LineEnv, path: string, payload: unknown, retryKey?: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/' + path, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN,
      'content-type': 'application/json',
      ...(retryKey ? { 'x-line-retry-key': retryKey } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function reply(env: LineEnv, replyToken: string, text: string) {
  try {
    await lineApi(env, 'reply', { replyToken, messages: [{ type: 'text', text }] });
  } catch (err) {
    console.error('LINE reply failed', err);
  }
}

// ---------------------------------------------------------------- booking alert

interface BookingRow {
  ref: string; mode: 'lab' | 'home'; source: string; branch: string | null; visit_date: string; slot: string;
  address: string | null; latitude: number | null; longitude: number | null; map_url: string | null;
  patient_type: string | null; distance_km: number | null; people: number;
  contact_name: string; contact_phone: string; contact_line: string | null; contact_email: string | null;
  note: string | null; lab_order_name: string | null;
  items_subtotal: number; travel_fee: number; total: number; referrer: string | null;
}
interface ItemRow { person_no: number; kind: string; name: string; price: number }

/** Pushes a new-booking alert to the bound LINE group. Never throws: errors are only logged. */
export async function notifyBooking(env: LineEnv, bookingId: string): Promise<void> {
  await pushAbout(env, bookingId, 'booking alert', (b, items) => bookingMessage(b, items));
}

/** Pushes a "tests edited" alert after staff saved changes in the Booking Console. Never throws. */
export async function notifyItemsChanged(
  env: LineEnv, bookingId: string, actor: string, edit: Pick<PricedEdit, 'added' | 'removed'>, oldTotal: number,
): Promise<void> {
  await pushAbout(env, bookingId, 'items alert', (b, items) => itemsChangedMessage(b, items, actor, edit, oldTotal));
}

async function pushAbout(env: LineEnv, bookingId: string, what: string, render: (b: BookingRow, items: ItemRow[]) => string) {
  try {
    if (!env.LINE_CHANNEL_ACCESS_TOKEN) return;
    const groupId = await boundGroup(env);
    if (!groupId) return;
    const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?1').bind(bookingId).first<BookingRow>();
    if (!b) return;
    const items = (await env.DB.prepare(
      'SELECT person_no, kind, name, price FROM booking_items WHERE booking_id = ?1 ORDER BY person_no, id',
    ).bind(bookingId).all<ItemRow>()).results;
    // LINE text messages are capped at 5,000 characters.
    const text = render(b, items).slice(0, 4900);
    await lineApi(env, 'push', { to: groupId, messages: [{ type: 'text', text }] }, crypto.randomUUID());
  } catch (err) {
    console.error('LINE ' + what + ' failed', bookingId, err);
  }
}

const baht = (n: number) => '฿' + n.toLocaleString('en-US');
const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thaiDate = (ymd: string) => {
  const d = new Date(ymd + 'T00:00:00Z');
  return `${TH_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
};
const phone = (p: string) => p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;

export function bookingMessage(b: BookingRow, items: ItemRow[]): string {
  const std = b.source === 'std';
  const kind = std ? 'ตรวจ HIV/STD' : b.mode === 'home' ? 'เจาะเลือดถึงบ้าน' : 'ตรวจที่สาขา';
  const L: string[] = [`🔔 การจองใหม่ · ${kind}`, `เลขที่จอง: ${b.ref}`, ''];

  if (b.mode === 'home') {
    L.push(`📅 ${thaiDate(b.visit_date)} · ${b.slot}`);
    if (b.address) L.push(`🏠 ${b.address}`);
    const map = b.map_url || (b.latitude != null && b.longitude != null ? `https://maps.google.com/?q=${b.latitude},${b.longitude}` : null);
    if (map) L.push(`🗺️ ${map}`);
    const near = b.branch ? ' จาก' + (BRANCH_NAMES[b.branch as keyof typeof BRANCH_NAMES] || b.branch) : ' (ลูกค้าประมาณเอง)';
    const extra = [b.distance_km != null ? `ระยะทาง ${b.distance_km} กม.${near}` : '', b.patient_type ? 'ผู้รับบริการ: ' + (PATIENT_LABELS[b.patient_type] || b.patient_type) : '']
      .filter(Boolean).join(' · ');
    if (extra) L.push(`🚗 ${extra}`);
  } else {
    L.push(`📍 ${(b.branch && BRANCH_NAMES[b.branch as keyof typeof BRANCH_NAMES]) || b.branch || '-'}`);
    L.push(`📅 ${thaiDate(b.visit_date)} · ${b.slot}`);
  }

  L.push('', `👤 ${b.contact_name}`, `📞 ${phone(b.contact_phone)}`);
  if (b.contact_line) L.push(`💬 LINE: ${b.contact_line}`);
  if (b.contact_email) L.push(`✉️ ${b.contact_email}`);

  L.push('', std ? '🧪 แพ็กเกจ' : `🧪 รายการตรวจ (${b.people} ท่าน)`, ...itemLines(b, items), '');
  if (b.travel_fee > 0) L.push(`💵 ค่าตรวจ ${baht(b.items_subtotal)}`, `🚗 ค่าบริการถึงบ้าน ${baht(b.travel_fee)}`);
  L.push(`💰 ยอดรวม ${baht(b.total)}` + (b.lab_order_name && !items.length ? ' (ยังไม่รวมค่าตรวจตามใบสั่งแพทย์)' : ''));
  if (b.note) L.push(`📝 หมายเหตุ: ${b.note}`);
  if (b.lab_order_name) L.push(`📎 ใบสั่งแพทย์: แนบแล้ว (${b.lab_order_name})`);
  L.push(`🔗 ที่มา: ${refLabel(b.referrer)}`);
  L.push('', 'เปิดดูในหลังบ้าน:', `${SITE}/admin#b/${b.ref}`);
  return L.join('\n');
}

function itemLines(b: BookingRow, items: ItemRow[]): string[] {
  const L: string[] = [];
  const people = Math.max(b.people, ...items.map(i => i.person_no));
  for (let n = 1; n <= people; n++) {
    const mine = items.filter(i => i.person_no === n);
    if (people > 1) L.push(`คนที่ ${n}`);
    for (const it of mine) L.push(` • ${it.name} ${baht(it.price)}`);
    if (!mine.length) L.push(b.lab_order_name ? ' • ตามใบสั่งแพทย์ · รอเจ้าหน้าที่แจ้งค่าตรวจ' : ' • ยังไม่ได้เลือก (ให้เจ้าหน้าที่ติดต่อกลับ)');
  }
  return L;
}

export function itemsChangedMessage(
  b: BookingRow, items: ItemRow[], actor: string, edit: Pick<PricedEdit, 'added' | 'removed'>, oldTotal: number,
): string {
  const where = b.mode === 'home' ? 'เจาะเลือดถึงบ้าน' : (b.branch && BRANCH_NAMES[b.branch as keyof typeof BRANCH_NAMES]) || b.branch || '-';
  const L: string[] = [
    `✏️ แก้ไขรายการตรวจ · ${b.ref}`,
    `โดย ${actor}`,
    '',
    `👤 ${b.contact_name} · 📞 ${phone(b.contact_phone)}`,
    `📅 ${thaiDate(b.visit_date)} · ${b.slot}`,
    `📍 ${where}`,
  ];
  if (edit.added.length) {
    L.push('', '➕ เพิ่ม');
    for (const x of edit.added) L.push(` • คนที่ ${x.person_no}: ${x.name} ${baht(x.price)}`);
  }
  if (edit.removed.length) {
    L.push('', '➖ ลบออก');
    for (const x of edit.removed) L.push(` • คนที่ ${x.person_no}: ${x.name} ${baht(x.price)}`);
  }
  L.push('', `🧪 รายการตรวจล่าสุด (${b.people} ท่าน)`, ...itemLines(b, items), '');
  if (b.travel_fee > 0) L.push(`💵 ค่าตรวจ ${baht(b.items_subtotal)}`, `🚗 ค่าบริการถึงบ้าน ${baht(b.travel_fee)}`);
  const diff = b.total - oldTotal;
  L.push(`💰 ยอดรวม ${baht(oldTotal)} → ${baht(b.total)} (${diff >= 0 ? '+' : '−'}${baht(Math.abs(diff))})`);
  L.push('', 'เปิดดูในหลังบ้าน:', `${SITE}/admin#b/${b.ref}`);
  return L.join('\n');
}
