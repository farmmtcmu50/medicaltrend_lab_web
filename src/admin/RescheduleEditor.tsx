// Booking Console: move an appointment to another date / time (and branch for lab visits).
// The Worker saves it, emails the customer the new appointment and alerts the staff LINE group.
import { useState, type CSSProperties } from 'react';
import { BRANCH_NAMES, type AdminBooking } from '../../shared/admin';
import { BRANCH_IDS, SLOTS, type BranchId } from '../../shared/catalog';
import { branchHours } from '../../shared/std';
import { api, ApiError } from './api';

const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const thDate = (ymd: string) => new Date(ymd + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const card: CSSProperties = { background: '#fff', border: '1.5px solid #CFE0F1', borderRadius: 18, padding: 20 };
const field: CSSProperties = { width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, color: '#0F2540', background: '#fff' };
const label: CSSProperties = { fontSize: 11.5, color: '#7C93AD', fontWeight: 600 };
const hourly = (slot: string) => /^\d{2}:00$/.test(slot);

/** Time choices: STD branch visits are hourly within opening hours, everything else uses the 2-hour windows. */
function slotChoices(b: AdminBooking, date: string, branch: string | null): { list: string[]; closed: boolean } {
  if (!hourly(b.slot)) return { list: [...SLOTS], closed: false };
  const hours = branch ? branchHours(branch as BranchId, new Date(date + 'T00:00:00Z').getUTCDay()) : null;
  if (!hours) return { list: [], closed: true };
  return { list: Array.from({ length: hours[1] - hours[0] }, (_, i) => String(hours[0] + i).padStart(2, '0') + ':00'), closed: false };
}

export default function RescheduleEditor({ b, toast, onCancel, onSaved, onConflict }: {
  b: AdminBooking; toast: (m: string) => void; onCancel: () => void; onSaved: (b: AdminBooking) => void; onConflict: () => void;
}) {
  const today = bkkToday();
  const [date, setDate] = useState(b.visit_date < today ? today : b.visit_date);
  const [slot, setSlot] = useState(b.slot);
  const [branch, setBranch] = useState<string | null>(b.branch);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const isLab = b.mode === 'lab';
  const { list, closed } = slotChoices(b, date, branch);
  const slotOk = list.includes(slot);
  const changed = date !== b.visit_date || slot !== b.slot || branch !== b.branch;
  const canSave = changed && slotOk && date >= today && !busy;
  const where = (br: string | null) => isLab ? (BRANCH_NAMES[br as BranchId] || br || '—') : 'เจาะเลือดถึงบ้าน';

  const save = async () => {
    if (!canSave) return;
    const msg = 'ยืนยันเปลี่ยนนัด ' + b.ref + '\nจาก ' + thDate(b.visit_date) + ' ' + b.slot + '\nเป็น ' + thDate(date) + ' ' + slot +
      (branch !== b.branch ? '\nสาขา: ' + where(branch) : '') + (b.contact_email ? '\n\nระบบจะส่งอีเมลแจ้งลูกค้า' : '\n\nลูกค้าไม่มีอีเมล กรุณาโทรแจ้งลูกค้า');
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const x = await api.reschedule(b.ref, { visitDate: date, slot, branch: isLab ? branch : null, message: message.trim(), expectedUpdatedAt: b.updated_at });
      toast('เปลี่ยนนัดแล้ว · ' + thDate(x.visit_date) + ' ' + x.slot + (b.contact_email ? ' · ส่งอีเมลแจ้งลูกค้าแล้ว' : ''));
      onSaved(x);
    } catch (e) {
      const code = (e as ApiError).code || 'network';
      if (code === 'conflict') { toast('มีผู้แก้ไขการจองนี้ก่อนหน้า กรุณาตรวจสอบแล้วลองใหม่'); onConflict(); return; }
      toast('บันทึกไม่สำเร็จ (' + code + ')');
    } finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>เลื่อน / แก้ไขนัด</div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#7C93AD' }}>นัดปัจจุบัน: {thDate(b.visit_date)} · {b.slot} · {where(b.branch)}</div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>วันนัดใหม่</span>
          <input type="date" value={date} min={today} max={addDays(today, 180)} onChange={e => setDate(e.target.value)} style={field} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>เวลา</span>
          <select value={slotOk ? slot : ''} onChange={e => setSlot(e.target.value)} disabled={closed} style={field}>
            {!slotOk && <option value="">{closed ? 'สาขาปิดวันนี้' : '— เลือกเวลา —'}</option>}
            {list.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {isLab && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>สาขา</span>
            <select value={branch || ''} onChange={e => setBranch(e.target.value)} style={field}>
              {BRANCH_IDS.map(id => <option key={id} value={id}>{BRANCH_NAMES[id]}</option>)}
            </select>
          </label>
        )}
      </div>
      {hourly(b.slot) && closed && <div style={{ marginTop: 8, fontSize: 12, color: '#A3242A' }}>สาขานี้ปิดในวันที่เลือก กรุณาเลือกวันอื่นหรือสาขาอื่น</div>}

      <label style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>ข้อความถึงลูกค้า (ไม่บังคับ · แสดงในอีเมล)</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={2} placeholder="เช่น เลื่อนตามที่ลูกค้าแจ้งทางโทรศัพท์ / ทีมเจาะเลือดไม่ว่างช่วงเวลาเดิม" style={{ ...field, resize: 'vertical' }} />
      </label>

      {changed && slotOk && (
        <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.6, background: '#F7FAFD', border: '1px solid #E4ECF5', borderRadius: 12, padding: '10px 12px' }}>
          <div><span style={{ color: '#8FA6C0', textDecoration: 'line-through' }}>{thDate(b.visit_date)} · {b.slot}{branch !== b.branch ? ' · ' + where(b.branch) : ''}</span></div>
          <div style={{ fontWeight: 700, color: '#0B4F9E' }}>→ {thDate(date)} · {slot}{branch !== b.branch ? ' · ' + where(branch) : ''}</div>
          <div style={{ marginTop: 4, color: b.contact_email ? '#0F7A6B' : '#A26A00' }}>
            {b.contact_email ? 'ระบบจะส่งอีเมลแจ้งนัดใหม่ถึง ' + b.contact_email + ' และแจ้งกลุ่ม LINE' : 'ลูกค้าไม่มีอีเมล กรุณาโทรแจ้งนัดใหม่ · ระบบจะแจ้งกลุ่ม LINE'}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} disabled={busy} style={{ border: '1.5px solid #DFE8F2', background: '#fff', color: '#536C89', fontSize: 12.5, fontWeight: 700, padding: '9px 16px', borderRadius: 999, cursor: 'pointer' }}>ยกเลิก</button>
        <button onClick={save} disabled={!canSave} style={{ border: 0, background: canSave ? '#1466C7' : '#B9CDE3', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 18px', borderRadius: 999, cursor: canSave ? 'pointer' : 'default' }}>{busy ? 'กำลังบันทึก…' : 'บันทึกนัดใหม่'}</button>
      </div>
    </div>
  );
}
