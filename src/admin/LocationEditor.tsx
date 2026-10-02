// Booking Console: move a home collection's pin. Staff paste a Google Maps link (or "lat, lng"), see the
// nearest branch, road distance and the new home-visit fee, then save. The Worker re-computes everything.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BRANCH_NAMES, type AdminBooking } from '../../shared/admin';
import { PRICING, travelFee } from '../../shared/catalog';
import type { DistanceResult } from '../../shared/geo';
import { findMapUrl, isShortMapUrl, mapsLinkFor, parseMapUrl } from '../../shared/maps';
import { api, ApiError } from './api';

const fmt = (n: number) => '฿' + n.toLocaleString('en-US');
const branchName = (id: string | null) => (id && BRANCH_NAMES[id as keyof typeof BRANCH_NAMES]) || 'ยังไม่ระบุสาขา';
const card: CSSProperties = { background: '#fff', border: '1.5px solid #CFE0F1', borderRadius: 18, padding: 20 };
const input: CSSProperties = { width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, color: '#0F2540', background: '#fff' };
const label: CSSProperties = { fontSize: 11.5, color: '#7C93AD', fontWeight: 600 };

type Pin = { lat: number; lng: number; mapUrl: string | null };
type Dist = { status: 'loading' } | { status: 'fail'; why: string } | (DistanceResult & { status: 'ok' });

/** "18.7961, 98.9679" typed or pasted as coordinates. */
const parseLatLng = (t: string) => {
  const m = t.trim().match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
};

export default function LocationEditor({ b, toast, onCancel, onSaved, onConflict }: {
  b: AdminBooking; toast: (m: string) => void; onCancel: () => void; onSaved: (b: AdminBooking) => void; onConflict: () => void;
}) {
  const [address, setAddress] = useState(b.address || '');
  const [link, setLink] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [linkState, setLinkState] = useState<'' | 'resolving' | 'bad'>('');
  const [dist, setDist] = useState<Dist | null>(null);
  const [busy, setBusy] = useState(false);
  const req = useRef(0);

  const onLink = (text: string) => {
    setLink(text);
    const n = ++req.current;
    setPin(null); setDist(null);
    const t = text.trim();
    if (!t) { setLinkState(''); return; }
    const ll = parseLatLng(t);
    if (ll) { setLinkState(''); setPin({ ...ll, mapUrl: null }); return; }
    const url = findMapUrl(t);
    if (!url) { setLinkState('bad'); return; }
    const direct = parseMapUrl(url);
    if (direct) { setLinkState(''); setPin({ lat: direct.lat, lng: direct.lng, mapUrl: url }); return; }
    if (!isShortMapUrl(url)) { setLinkState('bad'); return; }
    setLinkState('resolving');
    fetch('/api/maps/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      .then(r => r.json().catch(() => ({})))
      .then((r: { ok?: boolean; lat?: number; lng?: number }) => {
        if (n !== req.current) return;
        if (r.ok && typeof r.lat === 'number' && typeof r.lng === 'number') { setLinkState(''); setPin({ lat: r.lat, lng: r.lng, mapUrl: url }); }
        else setLinkState('bad');
      })
      .catch(() => { if (n === req.current) setLinkState('bad'); });
  };

  useEffect(() => {
    if (!pin) return;
    let live = true;
    setDist({ status: 'loading' });
    fetch(`/api/distance?lat=${pin.lat}&lng=${pin.lng}`)
      .then(r => r.json().catch(() => ({})))
      .then((r: Partial<DistanceResult> & { error?: string }) => {
        if (!live) return;
        if (r.ok && typeof r.km === 'number' && r.branch && r.method) setDist({ status: 'ok', ok: true, km: r.km, branch: r.branch, method: r.method });
        else setDist({ status: 'fail', why: r.error === 'bad_location' ? 'พิกัดอยู่นอกพื้นที่ภาคเหนือ' : 'คำนวณระยะทางไม่สำเร็จ' });
      })
      .catch(() => { if (live) setDist({ status: 'fail', why: 'คำนวณระยะทางไม่สำเร็จ' }); });
    return () => { live = false; };
  }, [pin]);

  const ok = dist?.status === 'ok' ? dist : null;
  const outOfArea = !!ok && ok.km > PRICING.maxKm;
  const newFee = ok && !outOfArea ? travelFee('home', ok.km, b.people) : null;
  const newTotal = newFee !== null ? b.items_subtotal + newFee : null;
  const canSave = !!pin && !!ok && !outOfArea && address.trim().length >= 3 && !busy;

  const save = async () => {
    if (!canSave || !pin || newTotal === null) return;
    const changed = newTotal !== b.total;
    const msg = 'บันทึกตำแหน่งใหม่ของ ' + b.ref + ' ?' + (changed
      ? '\nยอดรวมเปลี่ยนจาก ' + fmt(b.total) + ' เป็น ' + fmt(newTotal) + (b.contact_email ? '\nระบบจะส่งอีเมลแจ้งลูกค้า' : '\nลูกค้าไม่มีอีเมล กรุณาโทรแจ้งยอดใหม่')
      : '\nค่าบริการเท่าเดิม');
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const x = await api.setLocation(b.ref, { lat: pin.lat, lng: pin.lng, mapUrl: pin.mapUrl, address: address.trim(), expectedUpdatedAt: b.updated_at });
      toast(changed ? 'บันทึกแล้ว · ยอดใหม่ ' + fmt(x.total) + (b.contact_email ? ' · ส่งอีเมลแจ้งลูกค้าแล้ว' : '') : 'บันทึกตำแหน่งใหม่แล้ว');
      onSaved(x);
    } catch (e) {
      const code = (e as ApiError).code || 'network';
      if (code === 'conflict') { toast('มีผู้แก้ไขการจองนี้ก่อนหน้า กรุณาตรวจสอบแล้วลองใหม่'); onConflict(); return; }
      toast(code === 'out_of_area' ? 'ตำแหน่งนี้อยู่นอกพื้นที่ให้บริการ (เกิน ' + PRICING.maxKm + ' กม.)'
        : code === 'distance_unavailable' ? 'คำนวณระยะทางไม่สำเร็จ ลองใหม่อีกครั้ง' : 'บันทึกไม่สำเร็จ (' + code + ')');
    } finally { setBusy(false); }
  };

  const shown = pin ?? (b.latitude != null && b.longitude != null ? { lat: b.latitude, lng: b.longitude } : null);
  const row = (k: string, before: string, after: string | null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid #EEF3F9' }}>
      <span style={{ color: '#536C89' }}>{k}</span>
      <span style={{ textAlign: 'right', fontWeight: 600 }}>
        {after !== null && after !== before ? <><span style={{ color: '#8FA6C0', textDecoration: 'line-through', fontWeight: 500 }}>{before}</span> → <span style={{ color: '#0B4F9E' }}>{after}</span></> : before}
      </span>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>แก้ไขหมุดตำแหน่ง</div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#7C93AD', lineHeight: 1.5 }}>วางลิงก์ Google Maps หรือพิกัด เช่น 18.7961, 98.9679 · ระบบจะหาสาขาที่ใกล้ที่สุด คำนวณระยะทางและค่าบริการถึงบ้านใหม่ ({b.people} ท่าน)</div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>ลิงก์ Google Maps หรือพิกัดใหม่</span>
        <input value={link} onChange={e => onLink(e.target.value)} placeholder="https://maps.app.goo.gl/… หรือ 18.7961, 98.9679" style={input} autoFocus />
        {linkState === 'resolving' && <span style={{ fontSize: 12, color: '#7C93AD' }}>กำลังอ่านพิกัดจากลิงก์…</span>}
        {linkState === 'bad' && <span style={{ fontSize: 12, color: '#A3242A' }}>อ่านพิกัดจากข้อความนี้ไม่ได้ · กรุณาใช้ลิงก์ Google Maps ที่ปักหมุด หรือพิมพ์พิกัด "ละติจูด, ลองจิจูด"</span>}
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>ที่อยู่เข้าบริการ</span>
        <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} maxLength={500} style={{ ...input, resize: 'vertical' }} />
      </div>

      {shown && (
        <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid #E4ECF5' }}>
          <iframe title="แผนที่ตำแหน่ง" src={`https://maps.google.com/maps?q=${shown.lat},${shown.lng}&z=16&output=embed`} style={{ width: '100%', height: 220, border: 0, display: 'block' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div style={{ padding: '7px 10px', fontSize: 11.5, color: '#7C93AD', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>{pin ? 'หมุดใหม่' : 'หมุดเดิม'} · {shown.lat}, {shown.lng}</span>
            <a href={mapsLinkFor(shown.lat, shown.lng)} target="_blank" rel="noopener">เปิดใน Google Maps ↗</a>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {dist?.status === 'loading' && <div style={{ fontSize: 12.5, color: '#7C93AD' }}>กำลังคำนวณระยะทาง…</div>}
        {dist?.status === 'fail' && <div style={{ fontSize: 12.5, color: '#A3242A' }}>{dist.why}</div>}
        {outOfArea && <div style={{ fontSize: 12.5, color: '#A3242A' }}>ตำแหน่งนี้ห่าง {ok!.km} กม. เกินพื้นที่ให้บริการ ({PRICING.maxKm} กม.)</div>}
        {ok && !outOfArea && (
          <div>
            {row('สาขาที่ใกล้ที่สุด', branchName(b.branch), branchName(ok.branch))}
            {row('ระยะทาง', (b.distance_km ?? '-') + ' กม.', ok.km + ' กม.' + (ok.method === 'straight' ? ' (ประมาณ)' : ''))}
            {row('ค่าบริการถึงบ้าน', fmt(b.travel_fee), fmt(newFee!))}
            {row('ยอดรวม', fmt(b.total), fmt(newTotal!))}
            <div style={{ marginTop: 8, fontSize: 12, color: newTotal !== b.total ? '#A26A00' : '#0F7A6B' }}>
              {newTotal !== b.total
                ? (b.contact_email ? 'ยอดเปลี่ยน · ระบบจะส่งอีเมลแจ้งลูกค้า (' + b.contact_email + ') และแจ้งกลุ่ม LINE' : 'ยอดเปลี่ยน · ลูกค้าไม่มีอีเมล กรุณาโทรแจ้งลูกค้า · ระบบจะแจ้งกลุ่ม LINE')
                : 'ค่าบริการเท่าเดิม · ระบบจะแจ้งกลุ่ม LINE เรื่องตำแหน่งใหม่'}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} disabled={busy} style={{ border: '1.5px solid #DFE8F2', background: '#fff', color: '#536C89', fontSize: 12.5, fontWeight: 700, padding: '9px 16px', borderRadius: 999, cursor: 'pointer' }}>ยกเลิก</button>
        <button onClick={save} disabled={!canSave} style={{ border: 0, background: canSave ? '#1466C7' : '#B9CDE3', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 18px', borderRadius: 999, cursor: canSave ? 'pointer' : 'default' }}>{busy ? 'กำลังบันทึก…' : 'บันทึกตำแหน่งใหม่'}</button>
      </div>
    </div>
  );
}
