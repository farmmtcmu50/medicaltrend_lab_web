// Booking Console → Settings: home-collection fee rules (distance tiers, people covered, extra-person fee).
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { DEFAULT_HOME_PRICING, PRICING, travelFee, validateHomePricing, type HomePricing } from '../../shared/catalog';
import { fetchHomePricing } from '../usePricing';
import { api, ApiError, type PricingSetting } from './api';

const fmt = (n: number) => '฿' + n.toLocaleString('en-US');
const thDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const card: CSSProperties = { background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 22 };
const num: CSSProperties = { width: 92, border: '1.5px solid #DFE8F2', borderRadius: 10, padding: '8px 10px', fontSize: 13.5, fontWeight: 600, color: '#0F2540', background: '#fff', textAlign: 'right' };
const outlineBtn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 999, cursor: 'pointer' };

// Form state keeps strings so a field can be empty while typing.
type Form = { tiers: { upToKm: string; fee: string }[]; includedPeople: string; extraPersonFee: string };
const toForm = (p: HomePricing): Form => ({
  tiers: p.tiers.map(t => ({ upToKm: String(t.upToKm), fee: String(t.fee) })),
  includedPeople: String(p.includedPeople), extraPersonFee: String(p.extraPersonFee),
});
const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s));
const fromForm = (f: Form) => ({
  tiers: f.tiers.map(t => ({ upToKm: toNum(t.upToKm), fee: toNum(t.fee) })),
  includedPeople: toNum(f.includedPeople), extraPersonFee: toNum(f.extraPersonFee),
});
const ERRORS: Record<string, string> = {
  tiers: 'ต้องมีช่วงระยะทาง 1–12 ช่วง',
  tier_km: 'ระยะทางต้องเป็นจำนวนเต็ม 1–200 กม.',
  tier_fee: 'ค่าบริการต้องเป็นจำนวนเต็ม ฿0–100,000',
  tier_order: 'ระยะทางของแต่ละช่วงต้องมากกว่าช่วงก่อนหน้า',
  included_people: 'จำนวนท่านที่รวมในค่าบริการต้องเป็น 1–' + PRICING.maxPeople,
  extra_person_fee: 'ค่าบริการท่านที่เกินต้องเป็นจำนวนเต็ม ฿0–100,000',
};

export default function SettingsAdmin({ toast }: { toast: (m: string) => void }) {
  const [setting, setSetting] = useState<PricingSetting | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tryKm, setTryKm] = useState('8');
  const [tryPeople, setTryPeople] = useState('1');

  const apply = (s: PricingSetting) => { setSetting(s); setForm(toForm(s.pricing)); };
  const load = useCallback(() => { setErr(''); api.settings().then(apply).catch(e => setErr((e as ApiError).code || 'network')); }, []);
  useEffect(() => { load(); }, [load]);

  if (!setting || !form) {
    return <div style={{ ...card, textAlign: 'center', fontSize: 13, color: err ? '#A3242A' : '#7C93AD' }}>{err ? <>โหลดไม่สำเร็จ ({err}) <button onClick={load} style={outlineBtn}>ลองใหม่</button></> : 'กำลังโหลด…'}</div>;
  }

  const check = validateHomePricing(fromForm(form));
  const draft = check.ok ? check.pricing : null;
  const dirty = !draft || JSON.stringify(draft) !== JSON.stringify(setting.pricing);
  const setTier = (i: number, k: 'upToKm' | 'fee', v: string) => setForm(f => f && ({ ...f, tiers: f.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const addTier = () => setForm(f => {
    if (!f) return f;
    const last = f.tiers[f.tiers.length - 1];
    const km = (toNum(last?.upToKm ?? '0') || 0) + 10;
    return { ...f, tiers: [...f.tiers, { upToKm: String(km), fee: last?.fee ?? '' }] };
  });
  const removeTier = (i: number) => setForm(f => f && ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }));

  const save = async () => {
    if (!draft || !dirty) return;
    if (!confirm('บันทึกอัตราค่าบริการเจาะเลือดถึงบ้านใหม่?\nมีผลกับการจองใหม่ทันที · การจองเดิมยังคงค่าบริการเดิม')) return;
    setBusy(true);
    try { apply(await api.saveHomePricing(draft)); fetchHomePricing(true); toast('บันทึกอัตราค่าบริการแล้ว'); }
    catch (e) { toast('บันทึกไม่สำเร็จ (' + (ERRORS[(e as ApiError).code] || (e as ApiError).code || 'network') + ')'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!confirm('คืนค่าอัตราเริ่มต้นของระบบ?\n' + DEFAULT_HOME_PRICING.tiers.map((t, i, a) => `${i ? a[i - 1].upToKm + 1 : 1}–${t.upToKm} กม. ${fmt(t.fee)}`).join(' · '))) return;
    setBusy(true);
    try { apply(await api.resetHomePricing()); fetchHomePricing(true); toast('คืนค่าเริ่มต้นแล้ว'); }
    catch (e) { toast('บันทึกไม่สำเร็จ (' + ((e as ApiError).code || 'network') + ')'); }
    finally { setBusy(false); }
  };

  const tk = toNum(tryKm), tpRaw = toNum(tryPeople);
  const tp = Number.isFinite(tpRaw) ? Math.min(Math.max(1, Math.round(tpRaw)), PRICING.maxPeople) : 1;
  const areaKm = draft ? draft.tiers[draft.tiers.length - 1].upToKm : null;
  const tryFee = draft && Number.isFinite(tk) && tk >= 0 ? (Math.ceil(Math.max(tk, PRICING.minKm)) > areaKm! ? null : travelFee('home', tk, tp, draft)) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .25s ease both', maxWidth: 860 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>ค่าบริการเจาะเลือดถึงบ้าน</div>
          <div style={{ fontSize: 11.5, color: '#7C93AD' }}>
            {setting.isDefault ? 'ใช้อัตราเริ่มต้นของระบบ' : 'แก้ไขล่าสุด ' + thDateTime(setting.updatedAt!) + ' · ' + (setting.updatedBy || '')}
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12.5, color: '#536C89', lineHeight: 1.6 }}>
          คิดตามระยะทางถนนจากสาขาที่ใกล้ลูกค้าที่สุด (ปัดขึ้นเป็นกิโลเมตรเต็ม) เป็นค่าบริการต่อครั้ง · ระยะสิ้นสุดของช่วงสุดท้ายคือขอบเขตพื้นที่ให้บริการ
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(130px, 1fr) 40px', gap: 10, fontSize: 11, fontWeight: 700, color: '#7C93AD', letterSpacing: '.04em' }}>
            <span>ระยะทาง (กม.)</span><span>ค่าบริการต่อครั้ง</span><span />
          </div>
          {form.tiers.map((t, i) => {
            const from = i === 0 ? PRICING.minKm : (toNum(form.tiers[i - 1].upToKm) || 0) + 1;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(130px, 1fr) 40px', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ minWidth: 30, textAlign: 'right', color: '#536C89' }}>{Number.isFinite(from) ? from : '?'}</span> –
                  <input aria-label={'ระยะสิ้นสุดช่วงที่ ' + (i + 1)} inputMode="numeric" value={t.upToKm} onChange={e => setTier(i, 'upToKm', e.target.value.replace(/[^\d]/g, ''))} style={num} />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  ฿<input aria-label={'ค่าบริการช่วงที่ ' + (i + 1)} inputMode="numeric" value={t.fee} onChange={e => setTier(i, 'fee', e.target.value.replace(/[^\d]/g, ''))} style={num} />
                </span>
                <button onClick={() => removeTier(i)} disabled={form.tiers.length <= 1} aria-label={'ลบช่วงที่ ' + (i + 1)} title="ลบช่วงนี้"
                  style={{ border: 0, background: 'transparent', color: form.tiers.length <= 1 ? '#C9D6E4' : '#A3242A', fontSize: 18, cursor: form.tiers.length <= 1 ? 'default' : 'pointer' }}>×</button>
              </div>
            );
          })}
          {form.tiers.length < 12 && <button onClick={addTier} className="a-pale" style={{ ...outlineBtn, alignSelf: 'start', marginTop: 4 }}>+ เพิ่มช่วงระยะทาง</button>}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #EEF3F9', display: 'flex', flexWrap: 'wrap', gap: '12px 28px', fontSize: 13, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            ค่าบริการต่อครั้งรวมผู้รับบริการ
            <input inputMode="numeric" value={form.includedPeople} onChange={e => setForm({ ...form, includedPeople: e.target.value.replace(/[^\d]/g, '') })} style={{ ...num, width: 64 }} /> ท่าน
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            ท่านที่เกินคิดเพิ่ม ฿
            <input inputMode="numeric" value={form.extraPersonFee} onChange={e => setForm({ ...form, extraPersonFee: e.target.value.replace(/[^\d]/g, '') })} style={num} /> / ท่าน
          </label>
        </div>

        {!check.ok && <div role="alert" style={{ marginTop: 14, fontSize: 12.5, color: '#A3242A' }}>{ERRORS[check.error] || check.error}</div>}
        {draft && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#536C89' }}>
            พื้นที่ให้บริการ: ไม่เกิน <b style={{ color: '#0F2540' }}>{areaKm} กม.</b> จากสาขาที่ใกล้ที่สุด · เกินจากนี้ระบบจะไม่รับจองเจาะเลือดถึงบ้าน
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', gap: 8 }}>
            {!setting.isDefault && <button onClick={reset} disabled={busy} style={{ ...outlineBtn, color: '#536C89', borderColor: '#DFE8F2' }}>คืนค่าเริ่มต้น</button>}
            {dirty && <button onClick={() => setForm(toForm(setting.pricing))} disabled={busy} style={{ border: 0, background: 'transparent', color: '#7C93AD', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>ยกเลิกการแก้ไข</button>}
          </span>
          <button onClick={save} disabled={!draft || !dirty || busy}
            style={{ border: 0, background: draft && dirty && !busy ? '#1466C7' : '#B9CDE3', color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 20px', borderRadius: 999, cursor: draft && dirty && !busy ? 'pointer' : 'default' }}>
            {busy ? 'กำลังบันทึก…' : 'บันทึกอัตราค่าบริการ'}
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>ทดลองคำนวณ {dirty && draft ? '(ตามค่าที่กำลังแก้ ยังไม่บันทึก)' : ''}</div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'center', fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>ระยะทาง <input inputMode="decimal" value={tryKm} onChange={e => setTryKm(e.target.value.replace(/[^\d.]/g, ''))} style={{ ...num, width: 76 }} /> กม.</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>ผู้รับบริการ <input inputMode="numeric" value={tryPeople} onChange={e => setTryPeople(e.target.value.replace(/[^\d]/g, ''))} style={{ ...num, width: 64 }} /> ท่าน</label>
          <span style={{ fontSize: 15, fontWeight: 700, color: tryFee === null ? '#A3242A' : '#0B4F9E' }}>
            {tryFee === undefined ? '—' : tryFee === null ? 'นอกพื้นที่ให้บริการ' : 'ค่าบริการถึงบ้าน ' + fmt(tryFee)}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#7C93AD', lineHeight: 1.7, padding: '0 4px' }}>
        • อัตราใหม่มีผลกับการจองใหม่ทันที (หน้าเว็บที่ลูกค้าเปิดค้างไว้จะอัปเดตภายใน 1 นาที และระบบตรวจยอดซ้ำตอนกดจอง)<br />
        • การจองที่มีอยู่แล้วยังคงค่าบริการเดิม · จะคิดตามอัตราใหม่เฉพาะเมื่อเจ้าหน้าที่แก้หมุดตำแหน่ง หรือเปลี่ยนจำนวนผู้รับบริการ
      </div>
    </div>
  );
}
