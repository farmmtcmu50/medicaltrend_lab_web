// Booking Console: printable appointment slip at #/print/<ref>. Staff can fill in the names of
// other people and adjust the preparation text before printing; those edits are for the printout only.
import { useEffect, useState } from 'react';
import type { AdminBooking } from '../../shared/admin';
import type { Catalog } from '../../shared/catalog';
import SlipPages from '../slip/SlipPages';
import { api, ApiError } from './api';

export default function PrintSlip({ ref_: ref }: { ref_: string }) {
  const [b, setB] = useState<AdminBooking | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(ref).then(setB).catch(e => setErr((e as ApiError).code || 'network'));
    api.catalog().then(setCat).catch(() => setCat({ tests: [], packages: [], popular: [], source: 'snapshot', syncedAt: null }));
  }, [ref]);

  if (err) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>โหลดข้อมูลไม่สำเร็จ ({err})</div>;
  if (!b) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#7C93AD' }}>กำลังเตรียมใบนัด…</div>;

  return (
    <SlipPages b={b} catalog={cat} editable toolbar={<>
      <div>
        <b>ใบนัดหมาย {b.ref}</b> · {b.people} ใบ (1 ใบต่อผู้รับบริการ 1 ท่าน)
        <div style={{ fontSize: 12, color: '#536C89', marginTop: 3 }}>กรอกชื่อผู้รับบริการและแก้ไขการเตรียมตัวได้ในช่องสีเหลือง · ข้อมูลที่กรอกใช้สำหรับพิมพ์เท่านั้น ไม่ถูกบันทึก</div>
        {b.mode === 'home' && b.status === 'pending' && <div style={{ fontSize: 12, color: '#A26A00', marginTop: 3 }}>⚠ งานเจาะเลือดถึงบ้านนี้ยังไม่ได้ยืนยันนัด</div>}
      </div>
      <span style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => window.close()} className="ps-btn">ปิด</button>
        <button onClick={() => window.print()} className="ps-btn ps-primary">พิมพ์ใบนัด</button>
      </span>
    </>} />
  );
}
