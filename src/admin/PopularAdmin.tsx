// Booking Console → "Popular tests": the STEP 2 cards on the booking page.
// Keep a library of cards (poster + tests + price), switch each one on or off, and set the order.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { PopularRow } from '../../shared/admin';
import type { Catalog } from '../../shared/catalog';
import { api, type ApiError } from './api';

const fmt = (n: number) => n.toLocaleString('en-US');
const card: CSSProperties = { background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 16 };
const btn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer' };
const primary: CSSProperties = { ...btn, background: '#1466C7', borderColor: '#1466C7', color: '#fff' };
const input: CSSProperties = { width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: '#0F2540', background: '#fff' };

const ERRORS: Record<string, string> = {
  name: 'กรุณาใส่ชื่อ (อย่างน้อย 2 ตัวอักษร)', name_taken: 'ชื่อนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น', price: 'กรุณาใส่ราคา',
  tiers: 'ตรวจระดับราคาอีกครั้ง (ต้องมีชื่อและราคาทุกแถว)', poster: 'กรุณาเลือกรูปโฆษณา', poster_type: 'รูปต้องเป็น JPG, PNG หรือ WebP',
  poster_size: 'รูปใหญ่เกิน 5 MB', json_required: 'อัปโหลดไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่',
};

type Mode = 'price' | 'code' | 'tiers';
interface Draft {
  id?: string; name: string; nameEn: string; detail: string; detailEn: string; mode: Mode;
  price: string; was: string; code: string; tiers: { label: string; price: string }[]; stdLink: boolean; active: boolean;
  poster: string; file: Blob | null; preview: string;
}
const blank = (): Draft => ({ name: '', nameEn: '', detail: '', detailEn: '', mode: 'price', price: '', was: '', code: '', tiers: [{ label: '', price: '' }], stdLink: false, active: true, poster: '', file: null, preview: '' });
const fromRow = (r: PopularRow): Draft => {
  const tiers = r.tiers_json ? (JSON.parse(r.tiers_json) as { label: string; price: number }[]) : [];
  return {
    id: r.id, name: r.name, nameEn: r.name_en, detail: r.detail, detailEn: r.detail_en,
    mode: tiers.length ? 'tiers' : r.code ? 'code' : 'price',
    price: r.price?.toString() ?? '', was: r.was?.toString() ?? '', code: r.code ?? '',
    tiers: tiers.length ? tiers.map(t => ({ label: t.label, price: String(t.price) })) : [{ label: '', price: '' }],
    stdLink: !!r.std_link, active: !!r.active, poster: r.poster, file: null, preview: r.poster,
  };
};

/** Shrinks a picked image to ≤1120px WebP in the browser so the site stays fast. */
async function toWebp(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 1120 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/webp', 0.85));
}

export default function PopularAdmin({ toast }: { toast: (m: string) => void }) {
  const [items, setItems] = useState<PopularRow[] | null>(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    api.popular().then(r => setItems(r.items)).catch(e => setErr((e as ApiError).code || 'network'));
    api.catalog().then(setCatalog).catch(() => undefined);
  }, []);

  const codePrice = useMemo(() => {
    if (!catalog || !draft?.code) return null;
    const c = draft.code.trim().toUpperCase();
    const p = catalog.packages.find(x => x.id === c);
    if (p) return { name: p.name, price: p.price };
    const t = catalog.tests.find(x => x.id === c);
    return t ? { name: t.n, price: t.p } : null;
  }, [catalog, draft?.code]);

  const run = async (f: () => Promise<{ items: PopularRow[] }>, ok: string) => {
    setBusy(true);
    try { setItems((await f()).items); toast(ok); return true; }
    catch (e) { const c = (e as ApiError).code || 'network'; toast(ERRORS[c] || 'บันทึกไม่สำเร็จ (' + c + ')'); return false; }
    finally { setBusy(false); }
  };

  const move = (i: number, d: -1 | 1) => {
    if (!items) return;
    const ids = items.map(x => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.popularOrder(ids), 'บันทึกลำดับแล้ว');
  };

  const save = async () => {
    if (!draft) return;
    const d = draft;
    const data: Record<string, unknown> = {
      id: d.id, name: d.name, nameEn: d.nameEn, detail: d.detail, detailEn: d.detailEn, stdLink: d.stdLink, active: d.active,
      price: d.mode === 'price' ? d.price : null, was: d.was || null, code: d.mode === 'code' ? d.code : '',
      tiers: d.mode === 'tiers' ? d.tiers.filter(t => t.label || t.price) : [],
    };
    if (await run(() => api.savePopular(data, d.file), d.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว')) setDraft(null);
  };

  const pick = async (f: File | undefined) => {
    if (!f || !draft) return;
    try {
      const blob = await toWebp(f);
      setDraft({ ...draft, file: blob, preview: URL.createObjectURL(blob) });
    } catch { toast('อ่านรูปไม่สำเร็จ กรุณาใช้ไฟล์ JPG หรือ PNG'); }
  };

  if (err) return <div style={card}>โหลดข้อมูลไม่สำเร็จ ({err})</div>;
  if (!items) return <div style={card}>กำลังโหลด…</div>;
  const shown = items.filter(x => x.active).length;

  const priceLabel = (r: PopularRow) => {
    if (r.tiers_json) {
      const t = JSON.parse(r.tiers_json) as { price: number }[];
      return 'เริ่มต้น ฿' + fmt(Math.min(...t.map(x => x.price))) + ` · ${t.length} ระดับ`;
    }
    if (r.code) {
      const c = r.code.toUpperCase();
      const p = catalog?.packages.find(x => x.id === c)?.price ?? catalog?.tests.find(x => x.id === c)?.p;
      return `ตามชีต ${r.code}` + (p != null ? ' · ฿' + fmt(p) : '');
    }
    return r.price != null ? '฿' + fmt(r.price) : '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#536C89', lineHeight: 1.55 }}>
          แสดงบนหน้าเว็บ <b style={{ color: '#0F2540' }}>{shown}</b> จาก {items.length} รายการ · เรียงตามลำดับด้านล่าง · หน้าเว็บอัปเดตภายในประมาณ 1 นาที
        </span>
        <button onClick={() => setDraft(blank())} style={primary}>+ เพิ่ม Popular test</button>
      </div>

      {draft && (
        <div style={{ ...card, border: '1.5px solid #1466C7', boxShadow: '0 0 0 4px rgba(20,102,199,.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{draft.id ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</div>
            <label style={{ aspectRatio: '1 / 1', borderRadius: 14, border: '1.5px dashed #CFE0F1', background: '#F5F9FF', display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: 'pointer' }}>
              {draft.preview ? <img src={draft.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12.5, color: '#536C89', textAlign: 'center', padding: 16 }}>คลิกเพื่อเลือกรูปโฆษณา<br />แนะนำภาพสี่เหลี่ยมจัตุรัส JPG / PNG</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            {draft.preview && <span style={{ fontSize: 11.5, color: '#7C93AD' }}>คลิกที่รูปเพื่อเปลี่ยน · ระบบย่อรูปให้อัตโนมัติ</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
            <Field label="ชื่อ (ภาษาไทย) *"><input style={input} value={draft.name} maxLength={120} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="ชื่อ (English)"><input style={input} value={draft.nameEn} maxLength={120} onChange={e => setDraft({ ...draft, nameEn: e.target.value })} /></Field>
            <Field label="รายการตรวจ / รายละเอียด (ภาษาไทย)"><textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.detail} maxLength={400} onChange={e => setDraft({ ...draft, detail: e.target.value })} placeholder="เช่น FBS, HbA1c, Cholesterol, Triglyceride, HDL, LDL · รอผล 90 นาที" /></Field>
            <Field label="รายละเอียด (English)"><textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.detailEn} maxLength={400} onChange={e => setDraft({ ...draft, detailEn: e.target.value })} /></Field>
            <Field group label="การตั้งราคา">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['price', 'ราคาเดียว'], ['code', 'ตามรหัสในชีต'], ['tiers', 'หลายระดับราคา']] as [Mode, string][]).map(([m, l]) => (
                  <button key={m} type="button" onClick={() => setDraft({ ...draft, mode: m })} style={draft.mode === m ? primary : btn}>{l}</button>
                ))}
              </div>
            </Field>
            {draft.mode === 'price' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="ราคา (บาท) *"><input style={input} inputMode="numeric" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="ราคาเดิม (ขีดฆ่า)"><input style={input} inputMode="numeric" value={draft.was} onChange={e => setDraft({ ...draft, was: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
            )}
            {draft.mode === 'code' && (
              <Field label="รหัสใน Master Price List เช่น PAC-25 (ราคาจะเปลี่ยนตามชีตอัตโนมัติ)">
                <input style={input} value={draft.code} maxLength={20} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
                <span style={{ display: 'block', marginTop: 5, color: codePrice ? '#0B6E60' : '#A26A00' }}>
                  {draft.code ? (codePrice ? `พบ: ${codePrice.name} · ฿${fmt(codePrice.price)}` : 'ไม่พบรหัสนี้ในชีต') : ''}
                </span>
              </Field>
            )}
            {draft.mode === 'tiers' && (
              <Field group label="ระดับราคา (ลูกค้าเลือกได้ 1 ระดับ)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {draft.tiers.map((t, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 30px', gap: 6 }}>
                      <input style={input} placeholder="เช่น 3 เชื้อ" value={t.label} onChange={e => setDraft({ ...draft, tiers: draft.tiers.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                      <input style={input} placeholder="ราคา" inputMode="numeric" value={t.price} onChange={e => setDraft({ ...draft, tiers: draft.tiers.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/\D/g, '') } : x) })} />
                      <button type="button" onClick={() => setDraft({ ...draft, tiers: draft.tiers.filter((_, j) => j !== i) })} style={{ ...btn, padding: 0, color: '#A3242A' }} aria-label="ลบระดับ">×</button>
                    </div>
                  ))}
                  {draft.tiers.length < 8 && <button type="button" onClick={() => setDraft({ ...draft, tiers: [...draft.tiers, { label: '', price: '' }] })} style={{ ...btn, alignSelf: 'start' }}>+ เพิ่มระดับ</button>}
                </div>
              </Field>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.stdLink} onChange={e => setDraft({ ...draft, stdLink: e.target.checked })} style={{ marginTop: 2 }} />
              <span>ปุ่มในการ์ดพาไปจองที่หน้า HIV/STD (/std) แทนการเลือกลงรายการจอง</span>
            </label>
            {!draft.id && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
                <span>แสดงบนหน้าเว็บทันที</span>
              </label>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setDraft(null)} disabled={busy} style={btn}>ยกเลิก</button>
              <button type="button" onClick={save} disabled={busy} style={{ ...primary, opacity: busy ? .6 : 1 }}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(230px, 100%), 1fr))', gap: 14 }}>
        {items.map((r, i) => (
          <div key={r.id} style={{ ...card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: r.active ? 1 : .6 }}>
            <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#EAF3FF' }}>
              <img src={r.poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: r.active ? '#DFF5F0' : '#F0F4F9', color: r.active ? '#0B6E60' : '#5A7189' }}>
                {r.active ? `แสดงอยู่ · ลำดับ ${items.filter(x => x.active).indexOf(r) + 1}` : 'ซ่อนอยู่'}
              </span>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: '#536C89', lineHeight: 1.45 }}>{r.detail}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0B4F9E' }}>{priceLabel(r)}{r.std_link ? <span style={{ fontSize: 11, color: '#7A3E9D', fontWeight: 600 }}> · ลิงก์ไปหน้า STD</span> : null}</div>
              <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => run(() => api.popularActive(r.id, !r.active), r.active ? 'ซ่อนจากหน้าเว็บแล้ว' : 'แสดงบนหน้าเว็บแล้ว')} disabled={busy} style={r.active ? btn : primary}>{r.active ? 'ซ่อน' : 'แสดง'}</button>
                <button onClick={() => setDraft(fromRow(r))} disabled={busy} style={btn}>แก้ไข</button>
                <button onClick={() => move(i, -1)} disabled={busy || i === 0} style={{ ...btn, padding: '7px 10px' }} aria-label="เลื่อนขึ้น">↑</button>
                <button onClick={() => move(i, 1)} disabled={busy || i === items.length - 1} style={{ ...btn, padding: '7px 10px' }} aria-label="เลื่อนลง">↓</button>
                <button onClick={() => confirm('ลบ "' + r.name + '" ออกถาวร? (ถ้าเพียงไม่ต้องการแสดง ให้กด "ซ่อน")') && run(() => api.popularDelete(r.id), 'ลบแล้ว')} disabled={busy} style={{ ...btn, color: '#A3242A', borderColor: '#F3CFD1', marginLeft: 'auto' }}>ลบ</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  // Button groups must not sit inside a <label>: a click anywhere would fire the first button.
  const Tag = group ? 'div' : 'label';
  return (
    <Tag style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, color: '#6B7F99', fontWeight: 600 }}>{label}</span>
      {children}
    </Tag>
  );
}
