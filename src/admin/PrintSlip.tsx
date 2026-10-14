// Printable appointment slip (ใบนัดหมาย), one A5 page per person. Opened from the booking detail at #/print/<ref>.
// Staff can fill in the patient number (HN), names of other people and adjust the preparation text before printing;
// those edits are for the printout only and are not saved.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AdminBooking } from '../../shared/admin';
import { BRANCH_INFO } from '../../shared/branches';
import type { BranchId, Catalog } from '../../shared/catalog';
import { prepAdvice } from '../../shared/prep';
import { api, ApiError } from './api';

const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const longDate = (ymd: string) => { const d = new Date(ymd + 'T00:00:00Z'); return `วัน${TH_DAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} พ.ศ. ${d.getUTCFullYear() + 543}`; };
const slotText = (slot: string) => /^\d{2}:00$/.test(slot) ? slot + ' น.' : slot.replace('–', ' – ') + ' น.';
const MAIN_PHONE = '095 247 2631';

type Slip = { name: string; hn: string; prep: string };

export default function PrintSlip({ ref_: ref }: { ref_: string }) {
  const [b, setB] = useState<AdminBooking | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState('');
  const [slips, setSlips] = useState<Slip[] | null>(null);

  useEffect(() => {
    api.get(ref).then(setB).catch(e => setErr((e as ApiError).code || 'network'));
    api.catalog().then(setCat).catch(() => setCat({ tests: [], packages: [], popular: [], source: 'snapshot', syncedAt: null }));
  }, [ref]);

  // Item text for matching: the booked name plus the sheet's Thai description / package detail when known.
  const describe = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of cat?.tests ?? []) m.set('test|' + t.n, `${t.n} ${t.th} ${t.c}`);
    for (const p of cat?.packages ?? []) m.set('package|' + p.name, `${p.name} ${p.detail}`);
    for (const p of cat?.popular ?? []) m.set('package|' + p.name, `${p.name} ${p.detail}`);
    return (kind: string, name: string) => m.get(kind + '|' + name) ?? name;
  }, [cat]);

  useEffect(() => {
    if (!b || !cat || slips) return;
    setSlips(Array.from({ length: b.people }, (_, i) => {
      const items = b.items.filter(it => it.person_no === i + 1);
      const prep = prepAdvice({ items: items.map(it => ({ kind: it.kind, text: describe(it.kind, it.name) })), mode: b.mode, hasLabOrder: b.has_lab_order });
      return { name: i === 0 ? b.contact_name : '', hn: '', prep: prep.join('\n') };
    }));
  }, [b, cat, slips, describe]);

  if (err) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>โหลดข้อมูลไม่สำเร็จ ({err})</div>;
  if (!b || !slips) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#7C93AD' }}>กำลังเตรียมใบนัด…</div>;

  const branch = b.branch ? BRANCH_INFO[b.branch as BranchId] : null;
  const setSlip = (i: number, patch: Partial<Slip>) => setSlips(s => s && s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const input: CSSProperties = { border: '1.5px solid #CFE0F1', borderRadius: 8, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: '#FFFDF5' };

  return (
    <div className="ps-root">
      <style>{CSS}</style>
      <div className="ps-toolbar">
        <div>
          <b>ใบนัดหมาย {b.ref}</b> · {b.people} ใบ (1 ใบต่อผู้รับบริการ 1 ท่าน)
          <div style={{ fontSize: 12, color: '#536C89', marginTop: 3 }}>กรอกหมายเลขคนไข้ (ถ้ามี) และแก้ไขการเตรียมตัวได้ในช่องสีเหลือง · ข้อมูลที่กรอกใช้สำหรับพิมพ์เท่านั้น ไม่ถูกบันทึก</div>
          {b.status === 'pending' && <div style={{ fontSize: 12, color: '#A26A00', marginTop: 3 }}>⚠ การจองนี้ยังไม่ได้ยืนยันนัด</div>}
        </div>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.close()} className="ps-btn">ปิด</button>
          <button onClick={() => window.print()} className="ps-btn ps-primary">พิมพ์ใบนัด</button>
        </span>
      </div>

      {slips.map((s, i) => {
        const items = b.items.filter(it => it.person_no === i + 1);
        const prepLines = s.prep.split('\n').map(x => x.trim()).filter(Boolean);
        return (
          <section key={i} className="ps-page">
            <header className="ps-head">
              <img src="/img/logo-mt-company.webp" alt="" className="ps-logo" />
              <div style={{ flex: 1 }}>
                <div className="ps-brand">Medical Trend Lab Group</div>
                <div className="ps-sub">เมดิคอลเทรนด์ แล็บ กรุ๊ป · ห้องปฏิบัติการเทคนิคการแพทย์</div>
              </div>
              <div className="ps-title">
                ใบนัดหมาย
                <span>Appointment</span>
              </div>
            </header>
            <div className="ps-ref">เลขที่การจอง {b.ref}{b.people > 1 ? ` · ผู้รับบริการคนที่ ${i + 1}/${b.people}` : ''}</div>

            <table className="ps-table">
              <tbody>
                <tr>
                  <th>ชื่อ-นามสกุล</th>
                  <td>
                    <input className="ps-screen" style={input} value={s.name} placeholder="ชื่อ-นามสกุลผู้รับบริการ" onChange={e => setSlip(i, { name: e.target.value })} />
                    <span className="ps-print">{s.name || ' '}</span>
                  </td>
                </tr>
                <tr>
                  <th>หมายเลขคนไข้ (HN)</th>
                  <td>
                    <input className="ps-screen" style={{ ...input, maxWidth: 220 }} value={s.hn} placeholder="ถ้าไม่มีให้เว้นว่าง" onChange={e => setSlip(i, { hn: e.target.value })} />
                    <span className="ps-print">{s.hn || ' '}</span>
                  </td>
                </tr>
                <tr>
                  <th>{b.mode === 'home' ? 'สถานที่นัดหมาย' : 'สาขาที่นัดหมาย'}</th>
                  <td>
                    {b.mode === 'home' ? (
                      <><b>บริการเจาะเลือดถึงบ้าน</b>{branch ? ` (ทีมจาก${branch.name[0]})` : ''}<div className="ps-muted">{b.address}</div></>
                    ) : branch ? (
                      <><b>{branch.name[0]}</b><div className="ps-muted">{branch.address[0]} · โทร {branch.phone}</div></>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <th>วันที่นัดหมาย</th>
                  <td><b className="ps-big">{longDate(b.visit_date)}</b></td>
                </tr>
                <tr>
                  <th>เวลาที่นัดหมาย</th>
                  <td><b className="ps-big">{slotText(b.slot)}</b></td>
                </tr>
                <tr>
                  <th>รายการที่ตรวจ</th>
                  <td>
                    {items.length ? (
                      <ol className="ps-list">{items.map((it, j) => <li key={j}>{it.name}</li>)}</ol>
                    ) : b.has_lab_order ? 'ตามใบสั่งตรวจจากแพทย์' : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="ps-prep">
              <div className="ps-prep-title">การเตรียมตัวก่อนตรวจ</div>
              <textarea className="ps-screen" value={s.prep} rows={Math.max(5, prepLines.length + 1)} onChange={e => setSlip(i, { prep: e.target.value })}
                style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
              <ol className="ps-print ps-list">{prepLines.map((l, j) => <li key={j}>{l}</li>)}</ol>
            </div>

            <footer className="ps-foot">
              <div>หากต้องการเลื่อนหรือยกเลิกนัด กรุณาแจ้งล่วงหน้าอย่างน้อย 6 ชั่วโมง</div>
              <div>โทร {branch && b.mode === 'lab' ? branch.phone : MAIN_PHONE} · LINE @medicaltrend · lab@medicaltrend.co.th · lab.medicaltrend.stream</div>
            </footer>
          </section>
        );
      })}
    </div>
  );
}

const CSS = `
.ps-root { font-family: 'IBM Plex Sans Thai', 'Sarabun', 'Tahoma', sans-serif; color: #0F2540; background: #E9EEF5; min-height: 100vh; padding: 0 0 40px; }
.ps-toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  background: #fff; border-bottom: 1px solid #DFE8F2; padding: 12px 20px; font-size: 14px; }
.ps-btn { border: 1.5px solid #CFE0F1; background: #fff; color: #0B4F9E; font: inherit; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 999px; cursor: pointer; }
.ps-primary { background: #1466C7; border-color: #1466C7; color: #fff; }
.ps-page { width: 148mm; min-height: 210mm; margin: 20px auto 0; background: #fff; padding: 10mm 11mm; box-shadow: 0 10px 30px -18px rgba(4,28,58,.5);
  display: flex; flex-direction: column; box-sizing: border-box; }
.ps-head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 2.5px solid #0B4F9E; }
.ps-logo { height: 40px; width: auto; }
.ps-brand { font-size: 17px; font-weight: 700; color: #0B4F9E; letter-spacing: -.01em; font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; }
.ps-sub { font-size: 9.5px; color: #536C89; margin-top: 1px; }
.ps-title { text-align: right; font-size: 16px; font-weight: 700; line-height: 1.1; }
.ps-title span { display: block; font-size: 9.5px; font-weight: 500; color: #7C93AD; letter-spacing: .08em; text-transform: uppercase; }
.ps-ref { font-size: 10px; color: #7C93AD; margin: 6px 0 8px; text-align: right; }
.ps-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ps-table th { width: 33%; text-align: left; vertical-align: top; font-weight: 600; color: #536C89; padding: 6px 8px 6px 0; border-bottom: 1px solid #E4ECF5; }
.ps-table td { padding: 6px 0; border-bottom: 1px solid #E4ECF5; vertical-align: top; line-height: 1.45; }
.ps-big { font-size: 13.5px; }
.ps-muted { font-size: 10.5px; color: #536C89; margin-top: 2px; }
.ps-list { margin: 0; padding-left: 18px; }
.ps-list li { margin: 1px 0; }
.ps-prep { margin-top: 10px; border: 1.5px solid #BFE5DE; background: #F4FBF9; border-radius: 8px; padding: 8px 10px; font-size: 11px; line-height: 1.5; }
.ps-prep-title { font-weight: 700; color: #0A6E62; margin-bottom: 4px; font-size: 12px; }
.ps-foot { margin-top: auto; padding-top: 10px; border-top: 1px dashed #CFE0F1; font-size: 9.5px; color: #536C89; text-align: center; line-height: 1.6; }
.ps-print { display: none; }
@media print {
  @page { size: A5 portrait; margin: 0; }
  html, body { background: #fff !important; }
  .ps-root { background: #fff; padding: 0; }
  .ps-toolbar, .ps-screen { display: none !important; }
  .ps-print { display: block; }
  .ps-page { margin: 0; box-shadow: none; width: 148mm; height: 210mm; min-height: 0; page-break-after: always; break-after: page; overflow: hidden; }
  .ps-page:last-child { page-break-after: auto; break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
