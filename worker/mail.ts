// Customer emails through Resend (https://resend.com), sent as lab@medicaltrend.co.th.
//   booked     right after a booking is made (main site or /std)
//   priced     after staff edit the tests in the Booking Console (new total / lab-order price)
//   confirmed  staff set the status to "ยืนยันแล้ว"
//   cancelled  staff set the status to "ยกเลิก"
//   relocated  staff moved a home collection's pin and the home-visit fee changed
//   reminder   daily cron (18:00 Bangkok) for visits tomorrow
// Only bookings with a contact email get mail. Every attempt is logged in email_log; failures never
// affect the booking or the staff action. Secret: RESEND_API_KEY. Optional vars: MAIL_FROM, MAIL_REPLY_TO.
// STD bookings are worded neutrally (no test or disease names) because subjects show on lock screens.
import { BRANCH_INFO } from '../shared/branches';
import type { BranchId } from '../shared/catalog';
import { addDays, bangkokToday } from './util';

export interface MailEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_REPLY_TO?: string;
}

export type MailKind = 'booked' | 'priced' | 'confirmed' | 'cancelled' | 'reminder' | 'relocated';
/** Previous home-visit fee and total, for 'relocated'. */
export interface PriceBefore { travel: number; total: number }

const SITE = 'https://lab.medicaltrend.stream';
const DEFAULT_FROM = 'MedicalTrend Lab <lab@medicaltrend.co.th>';
const DEFAULT_REPLY_TO = 'lab@medicaltrend.co.th';
const MAIN_PHONE = '095 247 2631';

interface Row {
  id: string; ref: string; mode: 'lab' | 'home'; source: string; branch: string | null; status: string;
  visit_date: string; slot: string; address: string | null; distance_km: number | null; people: number;
  latitude?: number | null; longitude?: number | null; map_url?: string | null;
  contact_name: string; contact_email: string | null; lab_order_key: string | null;
  items_subtotal: number; travel_fee: number; total: number; lang: string;
}
interface Item { person_no: number; name: string; price: number }

/** Sends one customer email about a booking and logs it. Never throws. */
export async function mailCustomer(env: MailEnv, bookingId: string, kind: MailKind, before?: PriceBefore): Promise<void> {
  let to = '';
  try {
    if (!env.RESEND_API_KEY) return;
    const b = await env.DB.prepare(`SELECT id, ref, mode, source, branch, status, visit_date, slot, address, latitude, longitude, map_url, distance_km, people,
        contact_name, contact_email, lab_order_key, items_subtotal, travel_fee, total, lang FROM bookings WHERE id = ?1`)
      .bind(bookingId).first<Row>();
    if (!b?.contact_email) return;
    to = b.contact_email;
    const items = (await env.DB.prepare('SELECT person_no, name, price FROM booking_items WHERE booking_id = ?1 ORDER BY person_no, id')
      .bind(bookingId).all<Item>()).results;
    const mail = render(b, items, kind, before);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + cleanKey(env.RESEND_API_KEY), // tolerate a pasted newline or quotes
        'content-type': 'application/json',
        // booked/reminder go out once per booking; staff-triggered mails may repeat on purpose.
        'idempotency-key': kind === 'booked' || kind === 'reminder' ? `${b.id}-${kind}` : `${b.id}-${kind}-${Date.now()}`,
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || DEFAULT_FROM,
        to: [to],
        reply_to: env.MAIL_REPLY_TO || DEFAULT_REPLY_TO,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.json<{ id?: string; message?: string }>().catch(() => ({} as { id?: string; message?: string }));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message || ''}`.slice(0, 300));
    await log(env, bookingId, kind, to, 'sent', body.id || null, null);
  } catch (err) {
    console.error('customer email failed', bookingId, kind, err);
    if (to) await log(env, bookingId, kind, to, 'failed', null, String((err as Error)?.message || err).slice(0, 300));
  }
}

const log = (env: MailEnv, id: string, kind: MailKind, to: string, status: 'sent' | 'failed', providerId: string | null, error: string | null) =>
  env.DB.prepare('INSERT INTO email_log (booking_id, kind, at, to_addr, status, provider_id, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(id, kind, new Date().toISOString(), to, status, providerId, error).run()
    .catch(e => console.error('email_log write', e));

const cleanKey = (k: string) => k.trim().replace(/^["']|["']$/g, '');

/** Staff diagnostic: describes the stored key (never returns it) and asks Resend whether it accepts it. */
export async function mailCheck(env: MailEnv) {
  const raw = env.RESEND_API_KEY || '';
  const key = cleanKey(raw);
  const shape = {
    set: !!raw,
    length: key.length,
    startsWith_re_: key.startsWith('re_'),
    last4: key.length > 8 ? key.slice(-4) : '',
    hadWhitespaceOrQuotes: raw !== key,
    nonAscii: /[^\x21-\x7e]/.test(key),
  };
  if (!key) return { shape, verdict: 'ยังไม่ได้ตั้ง RESEND_API_KEY' };
  const res = await fetch('https://api.resend.com/domains', { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  const body = res ? await res.json<{ message?: string; name?: string; data?: { name: string; status: string }[] }>().catch(() => ({})) : {};
  const msg = (body as { message?: string }).message || '';
  const verdict = !res ? 'ติดต่อ Resend ไม่ได้'
    : res.ok ? 'API key ใช้ได้ (Full access)'
    : /restricted/i.test(msg) ? 'API key ใช้ได้ (Sending access)'
    : /invalid/i.test(msg) ? 'Resend ไม่รู้จัก API key นี้ — ตั้งค่าใหม่'
    : 'Resend ตอบ ' + res.status;
  return { shape, verdict, resend: { status: res?.status ?? null, message: msg, domains: (body as { data?: { name: string; status: string }[] }).data?.map(d => ({ name: d.name, status: d.status })) } };
}

/** Cron: remind every active booking with an email whose visit is tomorrow (Bangkok), once. */
export async function sendReminders(env: MailEnv): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const tomorrow = addDays(bangkokToday(), 1);
  const rows = (await env.DB.prepare(`SELECT id FROM bookings b WHERE visit_date = ?1 AND contact_email IS NOT NULL
      AND status IN ('pending', 'confirmed', 'assigned')
      AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.booking_id = b.id AND e.kind = 'reminder' AND e.status = 'sent')`)
    .bind(tomorrow).all<{ id: string }>()).results;
  for (const r of rows) {
    await mailCustomer(env, r.id, 'reminder');
    await new Promise(res => setTimeout(res, 600)); // stay under Resend's default 2 requests/second
  }
}

// ---------------------------------------------------------------- templates

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const baht = (n: number) => '฿' + n.toLocaleString('en-US');
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function longDate(ymd: string, en: boolean) {
  const d = new Date(ymd + 'T00:00:00Z');
  if (en) return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `วัน${TH_DAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

export function render(b: Row, items: Item[], kind: MailKind, before?: PriceBefore): { subject: string; html: string; text: string } {
  const en = b.lang === 'en';
  const L = (th: string, eng: string) => (en ? eng : th);
  const std = b.source === 'std';
  const rxPending = !!b.lab_order_key && items.length === 0;

  const subject = {
    booked: L(`ยืนยันการจอง ${b.ref}`, `Booking received ${b.ref}`),
    priced: L(`แจ้งยอดค่าบริการ ${b.ref}`, `Updated price for booking ${b.ref}`),
    confirmed: L(`ยืนยันนัดหมาย ${b.ref}`, `Appointment confirmed ${b.ref}`),
    cancelled: L(`ยกเลิกการจอง ${b.ref}`, `Booking cancelled ${b.ref}`),
    reminder: L(`เตือนนัดพรุ่งนี้ ${b.ref}`, `Reminder: your appointment tomorrow ${b.ref}`),
    relocated: L(`แจ้งปรับค่าบริการถึงบ้าน ${b.ref}`, `Updated home visit fee for booking ${b.ref}`),
  }[kind] + ' · MedicalTrend Lab';

  const hello = L(`เรียน คุณ${b.contact_name}`, `Dear ${b.contact_name},`);
  const intro = {
    booked: rxPending
      ? L('เราได้รับการจองและใบสั่งแพทย์ของคุณแล้ว เจ้าหน้าที่จะตรวจสอบใบสั่งแพทย์ แจ้งค่าตรวจ และโทรยืนยันนัดกับคุณอีกครั้ง',
        'We have received your booking and doctor\'s lab order. Our staff will review the order, let you know the lab fee and call you to confirm.')
      : L('เราได้รับการจองของคุณแล้ว เจ้าหน้าที่จะโทรยืนยันนัดกับคุณอีกครั้ง', 'We have received your booking. Our staff will call you to confirm the appointment.'),
    priced: L('เจ้าหน้าที่ได้ปรับปรุงรายการตรวจของคุณแล้ว รายละเอียดและยอดค่าบริการล่าสุดมีดังนี้',
      'Our staff have updated your tests. Here are the details and the latest total.'),
    confirmed: L('นัดหมายของคุณได้รับการยืนยันแล้ว เราพร้อมให้บริการตามวันและเวลาด้านล่าง', 'Your appointment is confirmed. We look forward to seeing you at the time below.'),
    cancelled: L('การจองด้านล่างถูกยกเลิกแล้ว หากคุณไม่ได้เป็นผู้ขอยกเลิก หรือต้องการนัดหมายใหม่ กรุณาติดต่อเรา',
      'The booking below has been cancelled. If you did not ask for this, or would like a new appointment, please contact us.'),
    reminder: L('ขอเตือนว่าพรุ่งนี้คุณมีนัดหมายกับเรา', 'This is a reminder of your appointment with us tomorrow.'),
    relocated: before
      ? L(`เจ้าหน้าที่ได้ปรับปรุงตำแหน่งสถานที่เจาะเลือดของคุณ ทำให้ค่าบริการถึงบ้านเปลี่ยนจาก ${baht(before.travel)} เป็น ${baht(b.travel_fee)} และยอดรวมเปลี่ยนจาก ${baht(before.total)} เป็น ${baht(b.total)} รายละเอียดล่าสุดมีดังนี้`,
        `Our staff have updated the location for your home blood collection. The home visit fee changed from ${baht(before.travel)} to ${baht(b.travel_fee)} and the total from ${baht(before.total)} to ${baht(b.total)}. Here are the latest details.`)
      : L('เจ้าหน้าที่ได้ปรับปรุงตำแหน่งสถานที่เจาะเลือดและค่าบริการถึงบ้านของคุณ รายละเอียดล่าสุดมีดังนี้',
        'Our staff have updated the location and home visit fee of your booking. Here are the latest details.'),
  }[kind];

  // --- details
  const rows: [string, string][] = [
    [L('เลขที่จอง', 'Booking reference'), `<b style="font-size:16px;letter-spacing:.03em">${esc(b.ref)}</b>`],
    [L('วันและเวลา', 'Date & time'), esc(longDate(b.visit_date, en) + ' · ' + b.slot)],
  ];
  const branch = b.branch && BRANCH_INFO[b.branch as BranchId];
  if (b.mode === 'home') {
    rows.push([L('บริการ', 'Service'), L('เจาะเลือดถึงบ้าน', 'Home blood collection')]);
    const pin = b.map_url || (b.latitude != null && b.longitude != null ? `https://www.google.com/maps?q=${b.latitude},${b.longitude}` : '');
    if (b.address || pin) rows.push([L('ที่อยู่', 'Address'), esc(b.address || '') + (pin ? `${b.address ? '<br>' : ''}<a href="${esc(pin)}" style="color:#0B4F9E">${L('ดูหมุดบนแผนที่', 'View pin on map')}</a>` : '')]);
  } else if (branch) {
    rows.push([L('สถานที่', 'Location'),
      `${esc(branch.name[en ? 1 : 0])}<br><span style="color:#536C89">${esc(branch.address[en ? 1 : 0])}</span><br>` +
      `<a href="${branch.map}" style="color:#0B4F9E">${L('เปิดแผนที่', 'Open map')}</a> · ${L('โทร', 'Tel')} ${branch.phone}`]);
  }

  const itemLines: string[] = [];
  if (std && items.length) {
    itemLines.push(esc(L('แพ็กเกจตรวจตามที่เลือก', 'Selected testing package')) + (items.length > 1 ? ` (${items.length})` : ''));
  } else {
    const people = Math.max(b.people, ...items.map(i => i.person_no));
    for (let n = 1; n <= people; n++) {
      const mine = items.filter(i => i.person_no === n);
      const who = people > 1 ? `<b>${L('คนที่', 'Person')} ${n}</b><br>` : '';
      const list = mine.length
        ? mine.map(i => `${esc(i.name)} <span style="color:#536C89">${baht(i.price)}</span>`).join('<br>')
        : esc(rxPending || b.lab_order_key ? L('ตามใบสั่งแพทย์', 'As per doctor\'s order') : L('เจ้าหน้าที่จะติดต่อเพื่อแนะนำรายการตรวจ', 'Staff will contact you to advise'));
      itemLines.push(who + list);
    }
  }
  if (kind !== 'cancelled' || items.length) rows.push([L('รายการตรวจ', 'Tests'), itemLines.join('<br><br>')]);
  if (b.mode === 'home') {
    rows.push([L('ค่าบริการถึงบ้าน', 'Home visit fee'), baht(b.travel_fee) + (b.distance_km ? ` <span style="color:#536C89">(${b.distance_km} ${L('กม.', 'km')})</span>` : '')]);
  }
  rows.push([L('ยอดรวม', 'Total'), rxPending
    ? `<b>${baht(b.total)}</b> <span style="color:#A26A00">${L('(ยังไม่รวมค่าตรวจตามใบสั่งแพทย์ เจ้าหน้าที่จะแจ้งให้ทราบ)', '(lab fee per doctor\'s order to be advised)')}</span>`
    : `<b style="font-size:18px;color:#0B4F9E">${baht(b.total)}</b>`]);

  // --- preparation
  const prep: string[] = [];
  if (kind !== 'cancelled') {
    if (b.slot.startsWith('06:00')) prep.push(L('งดอาหารและเครื่องดื่ม 8–10 ชั่วโมงก่อนเจาะเลือด (ดื่มน้ำเปล่าได้)', 'Fast for 8–10 hours before the blood draw (plain water is fine).'));
    if (b.lab_order_key) prep.push(L('กรุณาเตรียมใบสั่งแพทย์ฉบับจริงไว้ให้เจ้าหน้าที่', 'Please have the original doctor\'s order ready for our staff.'));
    if (b.mode === 'home') prep.push(L('ทีมเจาะเลือดจะโทรแจ้งก่อนเดินทางถึง', 'The collection team will call before arriving.'));
    else prep.push(L('กรุณามาถึงก่อนเวลานัดประมาณ 10 นาที', 'Please arrive about 10 minutes early.'));
    prep.push(L('หากต้องการเลื่อนหรือยกเลิก กรุณาแจ้งล่วงหน้าอย่างน้อย 6 ชั่วโมง', 'To reschedule or cancel, please let us know at least 6 hours ahead.'));
  }

  const contactPhone = (branch && branch.phone) || MAIN_PHONE;
  const html = `<!doctype html><html><body style="margin:0;background:#EEF3F9;font-family:'Sarabun','Tahoma','Segoe UI',Arial,sans-serif;color:#0F2540">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0B4F9E;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold">MedicalTrend Lab<div style="font-size:13px;font-weight:normal;color:#CFE0F1;margin-top:4px">${esc(subject.replace(' · MedicalTrend Lab', ''))}</div></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 10px;font-size:15px">${esc(hello)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.55;border-top:1px solid #E4ECF5">
${rows.map(([k, v]) => `<tr><td style="padding:10px 12px 10px 0;color:#6B7F99;vertical-align:top;width:34%;border-bottom:1px solid #E4ECF5">${esc(k)}</td><td style="padding:10px 0;vertical-align:top;border-bottom:1px solid #E4ECF5">${v}</td></tr>`).join('\n')}
</table>
${prep.length ? `<div style="margin-top:18px;padding:14px 16px;background:#F4FBF9;border:1px solid #BFE5DE;border-radius:12px;font-size:14px;line-height:1.6;color:#0A6E62"><b>${L('การเตรียมตัว', 'Before your visit')}</b><ul style="margin:6px 0 0;padding-left:20px">${prep.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#3D5674">${L('สอบถามเพิ่มเติม', 'Questions?')}: ${L('โทร', 'Tel')} ${contactPhone} · LINE @medicaltrend · <a href="mailto:lab@medicaltrend.co.th" style="color:#0B4F9E">lab@medicaltrend.co.th</a><br>${L('ตอบกลับอีเมลนี้เพื่อติดต่อเจ้าหน้าที่ได้โดยตรง', 'You can reply to this email to reach our staff.')}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#F7FAFD;font-size:12px;color:#8FA6C0;line-height:1.5">${L('บริษัท เมดิคอลเทรนด์ จำกัด', 'Medical Trend Co., Ltd.')} · <a href="${SITE}" style="color:#8FA6C0">lab.medicaltrend.stream</a><br>${L('อีเมลนี้ส่งถึงคุณเนื่องจากมีการจองบริการด้วยอีเมลนี้', 'You received this email because a booking was made with this address.')}</td></tr>
</table></td></tr></table></body></html>`;

  const strip = (h: string) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const text = [
    hello, '', intro, '',
    ...rows.map(([k, v]) => `${k}: ${strip(v)}`),
    ...(prep.length ? ['', L('การเตรียมตัว', 'Before your visit') + ':', ...prep.map(p => '- ' + p)] : []),
    '', `${L('สอบถามเพิ่มเติม', 'Questions?')}: ${contactPhone} · LINE @medicaltrend · lab@medicaltrend.co.th`,
  ].join('\n');
  return { subject, html, text };
}
