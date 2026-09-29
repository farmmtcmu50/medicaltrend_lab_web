// Booking detail → "แก้ไขรายการตรวจ": add/remove packages and tests per person, preview the new total,
// then save. The Worker re-prices with the same priceEdit() and posts the change to the staff LINE group.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AdminBooking } from '../../shared/admin';
import { MAX_PERSONS, priceBook, priceEdit, type BookItem, type EditItem } from '../../shared/itemEdit';
import { api, type ApiError } from './api';

const fmt = (n: number) => n.toLocaleString('en-US');
const card: CSSProperties = { background: '#fff', border: '1.5px solid #1466C7', borderRadius: 18, padding: 20, boxShadow: '0 0 0 4px rgba(20,102,199,.08)' };
const smallBtn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer' };
const xBtn: CSSProperties = { border: 0, background: '#FDECEC', color: '#A3242A', width: 26, height: 26, borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 700, flexShrink: 0, lineHeight: 1 };

const ERRORS: Record<string, string> = {
  conflict: 'มีผู้อื่นแก้ไขการจองนี้ระหว่างที่คุณแก้ไข ระบบโหลดข้อมูลล่าสุดแล้ว กรุณาแก้ไขอีกครั้ง',
  unknown_items: 'มีรายการที่ไม่อยู่ในรายการราคาปัจจุบัน กรุณาลบแล้วเลือกใหม่',
  booking_cancelled: 'การจองนี้ถูกยกเลิกแล้ว แก้ไขรายการไม่ได้',
};

export default function ItemEditor({ b, onSaved, onCancel, onConflict, toast }: {
  b: AdminBooking; onSaved: (b: AdminBooking) => void; onCancel: () => void; onConflict: () => void; toast: (m: string) => void;
}) {
  const [persons, setPersons] = useState<EditItem[][]>(() => {
    const n = Math.max(1, b.people, ...b.items.map(i => i.person_no));
    return Array.from({ length: n }, (_, i) => b.items.filter(it => it.person_no === i + 1).map(it => ({ kind: it.kind, name: it.name })));
  });
  const [active, setActive] = useState(0);
  const [book, setBook] = useState<BookItem[] | null>(null);
  const [bookErr, setBookErr] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.catalog().then(c => setBook(priceBook(c))).catch(() => setBookErr(true));
  }, []);

  const preview = useMemo(() => priceEdit(b.items, persons, book || []), [b.items, persons, book]);
  const newTotal = preview.subtotal + b.travel_fee;
  const changed = preview.added.length > 0 || preview.removed.length > 0 || persons.length !== b.people;
  const isNew = (p: number, it: EditItem) => preview.added.some(x => x.person_no === p + 1 && x.kind === it.kind && x.name === it.name);
  const priceOf = (p: number, it: EditItem) => preview.persons[p]?.items.find(x => x.kind === it.kind && x.name === it.name)?.price;

  const results = useMemo(() => {
    if (!book) return [];
    const s = q.trim().toLowerCase();
    const list = s
      ? book.filter(x => x.name.toLowerCase().includes(s) || (x.code || '').toLowerCase().includes(s) || (x.detail || '').toLowerCase().includes(s))
      : book.filter(x => x.kind === 'package');
    return list.slice(0, 40);
  }, [book, q]);

  const has = (p: number, x: { kind: string; name: string }) => persons[p]?.some(it => it.kind === x.kind && it.name === x.name);
  const add = (x: BookItem) => setPersons(ps => ps.map((items, i) => i === active && !has(i, x) ? [...items, { kind: x.kind, name: x.name }] : items));
  const remove = (p: number, it: EditItem) => setPersons(ps => ps.map((items, i) => i === p ? items.filter(y => !(y.kind === it.kind && y.name === it.name)) : items));
  const addPerson = () => { setPersons(ps => [...ps, []]); setActive(persons.length); };
  const removePerson = (p: number) => {
    if (persons[p].length && !confirm(`ลบคนที่ ${p + 1} พร้อมรายการตรวจทั้งหมดของคนนี้?`)) return;
    setPersons(ps => ps.filter((_, i) => i !== p));
    setActive(a => Math.max(0, a >= p ? a - 1 : a));
  };

  const save = async () => {
    if (!changed || busy) return;
    const diff = newTotal - b.total;
    if (!confirm(`บันทึกรายการตรวจใหม่ของ ${b.ref}\nยอดรวม ฿${fmt(b.total)} → ฿${fmt(newTotal)} (${diff >= 0 ? '+' : '−'}฿${fmt(Math.abs(diff))})\nและแจ้งเตือนเข้ากลุ่ม LINE?`)) return;
    setBusy(true);
    try {
      onSaved(await api.editItems(b.ref, persons, b.updated_at));
      toast('บันทึกรายการตรวจแล้ว · แจ้งกลุ่ม LINE');
    } catch (e) {
      const code = (e as ApiError).code || 'network';
      toast(ERRORS[code] || 'บันทึกไม่สำเร็จ (' + code + ')');
      if (code === 'conflict') onConflict();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>แก้ไขรายการตรวจ</span>
        <span style={{ fontSize: 11.5, color: '#7C93AD' }}>รายการเดิมคงราคาเดิม · รายการใหม่ใช้ราคาจากชีตล่าสุด</span>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {persons.map((items, p) => {
          const on = p === active;
          return (
            <div key={p} onClick={() => setActive(p)} style={{ border: '1.5px solid ' + (on ? '#1466C7' : '#E9F0F8'), background: on ? '#F5F9FF' : '#FBFDFF', borderRadius: 14, padding: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                  คนที่ {p + 1}
                  {on && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: '#1466C7', padding: '3px 8px', borderRadius: 999 }}>กำลังเพิ่มรายการให้คนนี้</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0B4F9E' }}>฿{fmt(preview.persons[p]?.subtotal || 0)}</span>
                  {persons.length > 1 && <button type="button" onClick={e => { e.stopPropagation(); removePerson(p); }} style={{ ...smallBtn, padding: '5px 10px', color: '#A3242A', borderColor: '#F3CFD1' }}>ลบคนนี้</button>}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(it => {
                  const price = priceOf(p, it);
                  return (
                    <div key={it.kind + it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                      <span style={{ flex: 1, minWidth: 0, color: '#3D5674', lineHeight: 1.45 }}>
                        {it.kind === 'package' ? '📦 ' : ''}{it.name}
                        {isNew(p, it) && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: '#0B6E60', background: '#DFF5F0', padding: '2px 7px', borderRadius: 999 }}>ใหม่</span>}
                      </span>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: price === undefined ? '#A3242A' : undefined }}>{price === undefined ? (book ? 'ไม่พบราคา' : '…') : '฿' + fmt(price)}</span>
                      <button type="button" aria-label={'ลบ ' + it.name} onClick={e => { e.stopPropagation(); remove(p, it); }} style={xBtn}>×</button>
                    </div>
                  );
                })}
                {!items.length && <span style={{ fontSize: 12, color: '#8FA6C0' }}>ยังไม่มีรายการ · ค้นหาด้านล่างเพื่อเพิ่ม</span>}
              </div>
            </div>
          );
        })}
        {persons.length < MAX_PERSONS && <button type="button" onClick={addPerson} style={{ ...smallBtn, alignSelf: 'start' }}>+ เพิ่มผู้รับบริการ</button>}
      </div>

      <div style={{ marginTop: 16 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`ค้นหาแพ็กเกจหรือรายการตรวจ (ชื่อ / รหัส) เพื่อเพิ่มให้คนที่ ${active + 1}`}
          style={{ width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, color: '#0F2540' }} />
        <div style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', border: '1px solid #EEF3F9', borderRadius: 12 }}>
          {bookErr && <div style={{ padding: 14, fontSize: 12.5, color: '#A3242A' }}>โหลดรายการราคาไม่สำเร็จ ลองรีเฟรชหน้า</div>}
          {!book && !bookErr && <div style={{ padding: 14, fontSize: 12.5, color: '#8FA6C0' }}>กำลังโหลดรายการราคา…</div>}
          {book && !q.trim() && <div style={{ padding: '10px 12px 4px', fontSize: 11, color: '#7C93AD' }}>แสดงแพ็กเกจทั้งหมด · พิมพ์เพื่อค้นหารายการเดี่ยว</div>}
          {book && results.map(x => {
            const already = has(active, x);
            return (
              <button type="button" key={x.kind + x.name} disabled={already} onClick={() => add(x)} className="a-row"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, borderBottom: '1px solid #F1F5FA', background: 'transparent', padding: '9px 12px', textAlign: 'left', cursor: already ? 'default' : 'pointer', opacity: already ? .45 : 1 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0B4F9E', background: '#EAF3FF', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{x.group}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4 }}>
                  {x.code && <span style={{ fontSize: 10.5, color: '#8FA6C0', marginRight: 6 }}>{x.code}</span>}
                  <span style={{ fontWeight: 600, color: '#0F2540' }}>{x.name}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>฿{fmt(x.price)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: already ? '#8FA6C0' : '#1466C7', whiteSpace: 'nowrap' }}>{already ? 'มีแล้ว' : '+ เพิ่ม'}</span>
              </button>
            );
          })}
          {book && q.trim() && !results.length && <div style={{ padding: 14, fontSize: 12.5, color: '#8FA6C0' }}>ไม่พบรายการ</div>}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: '#F5F9FF', border: '1px solid #DCE8F6', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
        <Row label="ยอดรวมเดิม" value={'฿' + fmt(b.total)} />
        <Row label="ค่าตรวจใหม่" value={'฿' + fmt(preview.subtotal)} />
        {b.mode === 'home' && <Row label={`ค่าเดินทาง (${b.distance_km} กม.)`} value={b.travel_fee ? '฿' + fmt(b.travel_fee) : 'ฟรี'} />}
        <div style={{ borderTop: '1px dashed #CFE0F1', margin: '3px 0' }} />
        <Row label={<b>ยอดรวมใหม่</b>} value={<b style={{ fontSize: 17, color: '#0B4F9E' }}>฿{fmt(newTotal)}</b>} />
        <Row label="ส่วนต่าง" value={<b style={{ color: newTotal - b.total > 0 ? '#0B6E60' : newTotal - b.total < 0 ? '#A3242A' : '#5A7189' }}>{newTotal - b.total >= 0 ? '+' : '−'}฿{fmt(Math.abs(newTotal - b.total))}</b>} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={smallBtn}>ยกเลิก</button>
        <button type="button" onClick={save} disabled={!changed || busy || !book || preview.unknown.length > 0}
          style={{ ...smallBtn, background: '#1466C7', borderColor: '#1466C7', color: '#fff', opacity: !changed || busy || !book || preview.unknown.length > 0 ? .5 : 1 }}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกและแจ้ง LINE'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#536C89' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
