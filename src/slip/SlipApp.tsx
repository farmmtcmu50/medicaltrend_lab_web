// /slip — customers look up their booking (reference + phone used to book) and print the appointment slip.
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { Catalog } from '../../shared/catalog';
import SlipPages, { longDate, type SlipData } from './SlipPages';

const PRINTABLE = ['confirmed', 'assigned', 'enroute', 'collected', 'lab', 'result', 'done'];
const card: CSSProperties = { background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 24, boxShadow: '0 20px 40px -30px rgba(4,28,58,.4)' };
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #DFE8F2', borderRadius: 12, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#0F2540', background: '#fff' };
const label: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#3D5674', display: 'block', marginBottom: 6 };
const font = "'IBM Plex Sans Thai', 'Sarabun', 'Tahoma', sans-serif";

export default function SlipApp() {
  const [ref, setRef] = useState(() => (new URLSearchParams(location.search).get('ref') || '').toUpperCase());
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [b, setB] = useState<SlipData | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(setCat)
      .catch(() => setCat({ tests: [], packages: [], popular: [], source: 'snapshot', syncedAt: null }));
  }, []);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^MT-\d{6}-[A-Z0-9]{4}$/.test(ref.trim())) return setErr('กรุณากรอกเลขที่การจองให้ถูกต้อง เช่น MT-261015-AB12');
    if (phone.replace(/\D/g, '').length < 9) return setErr('กรุณากรอกเบอร์โทรศัพท์ที่ใช้ตอนจอง');
    setBusy(true);
    try {
      const res = await fetch('/api/slip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: ref.trim(), phone }) });
      if (res.status === 404) setErr('ไม่พบการจอง กรุณาตรวจสอบเลขที่การจองและเบอร์โทรศัพท์ที่ใช้จองอีกครั้ง');
      else if (!res.ok) setErr('ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หรือโทร 095 247 2631');
      else setB(await res.json());
    } catch {
      setErr('เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  if (b && PRINTABLE.includes(b.status)) {
    return (
      <SlipPages b={b} catalog={cat} editable={false} toolbar={<>
        <div>
          <b>ใบนัดหมาย {b.ref}</b>{b.people > 1 ? ` · ${b.people} ใบ (1 ใบต่อผู้รับบริการ 1 ท่าน)` : ''}
          <div style={{ fontSize: 12, color: '#536C89', marginTop: 3 }}>กดพิมพ์ หรือเลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์เพื่อเก็บไว้ในโทรศัพท์</div>
        </div>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setB(null)} className="ps-btn">ค้นหาใหม่</button>
          <button onClick={() => window.print()} className="ps-btn ps-primary">พิมพ์ใบนัด</button>
        </span>
      </>} />
    );
  }

  return (
    <div style={{ fontFamily: font, color: '#0F2540', background: '#EEF3F9', minHeight: '100vh' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #E4ECF5' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <img src="/img/logo-mt-company.webp" alt="" style={{ height: 34 }} />
            <span style={{ fontWeight: 700, color: '#0B4F9E', fontFamily: "'IBM Plex Sans', sans-serif" }}>Medical Trend Lab Group</span>
          </a>
        </div>
      </header>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 60px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-.02em' }}>พิมพ์ใบนัดหมาย</h1>
        <p style={{ margin: '0 0 20px', fontSize: 14.5, color: '#536C89', lineHeight: 1.6 }}>
          กรอกเลขที่การจองและเบอร์โทรศัพท์ที่ใช้ตอนจอง เพื่อดูและพิมพ์ใบนัดพร้อมคำแนะนำการเตรียมตัวก่อนตรวจ
        </p>

        {b ? (
          <div style={card} role="status">
            <div style={{ fontSize: 13, color: '#7C93AD' }}>เลขที่การจอง</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0B4F9E', fontFamily: "'IBM Plex Sans', sans-serif" }}>{b.ref}</div>
            <div style={{ marginTop: 6, fontSize: 14.5 }}>{longDate(b.visit_date)} · {b.slot}</div>
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, fontSize: 14.5, lineHeight: 1.6, ...(b.status === 'cancelled'
              ? { background: '#FDECEC', color: '#A3242A' } : { background: '#FFF4E0', color: '#7A5200' }) }}>
              {b.status === 'cancelled'
                ? 'การจองนี้ถูกยกเลิกแล้ว หากต้องการนัดหมายใหม่ กรุณาจองใหม่หรือติดต่อเรา'
                : 'การจองของคุณอยู่ระหว่างรอเจ้าหน้าที่ยืนยันนัด ใบนัดจะพิมพ์ได้หลังจากยืนยันนัดแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว'}
            </div>
            <button onClick={() => setB(null)} style={{ marginTop: 16, border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 14, fontWeight: 700, padding: '10px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' }}>ค้นหาใหม่</button>
          </div>
        ) : (
          <form onSubmit={lookup} style={card} noValidate>
            <label style={label} htmlFor="ref">เลขที่การจอง</label>
            <input id="ref" style={{ ...field, fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '.03em' }} value={ref} placeholder="MT-261015-AB12" autoCapitalize="characters"
              onChange={e => setRef(e.target.value.toUpperCase())} />
            <label style={{ ...label, marginTop: 14 }} htmlFor="phone">เบอร์โทรศัพท์ที่ใช้จอง</label>
            <input id="phone" style={field} value={phone} placeholder="08x-xxx-xxxx" inputMode="tel" autoComplete="tel" onChange={e => setPhone(e.target.value)} />
            {err && <div role="alert" style={{ marginTop: 12, fontSize: 14, color: '#A3242A', lineHeight: 1.5 }}>{err}</div>}
            <button type="submit" disabled={busy} style={{ marginTop: 18, width: '100%', border: 0, background: '#1466C7', color: '#fff', fontSize: 16, fontWeight: 700, padding: '14px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'กำลังค้นหา…' : 'ดูใบนัดหมาย'}
            </button>
            <div style={{ marginTop: 14, fontSize: 13, color: '#7C93AD', lineHeight: 1.6 }}>
              เลขที่การจองอยู่ในหน้ายืนยันการจองและอีเมลจากเรา · สอบถามโทร 095 247 2631 หรือ LINE @medicaltrend
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
