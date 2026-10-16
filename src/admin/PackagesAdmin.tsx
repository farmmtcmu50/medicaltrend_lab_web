// Booking Console → "Packages": the STEP 3 package list on the booking page.
// Starts from the Master Price List's PAC-xx rows; staff rename, describe, re-price, add, hide and order them.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { PackageRow } from '../../shared/admin';
import { posterFor, type Catalog } from '../../shared/catalog';
import { api, type ApiError } from './api';

const fmt = (n: number) => n.toLocaleString('en-US');
const card: CSSProperties = { background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 16 };
const btn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer' };
const primary: CSSProperties = { ...btn, background: '#1466C7', borderColor: '#1466C7', color: '#fff' };
const input: CSSProperties = { width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: '#0F2540', background: '#fff' };

const ERRORS: Record<string, string> = {
  name: 'กรุณาใส่ชื่อ (อย่างน้อย 2 ตัวอักษร)', name_taken: 'ชื่อนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น', price: 'กรุณาใส่ราคา หรือรหัสในชีต',
  poster_type: 'รูปต้องเป็น JPG, PNG หรือ WebP', poster_size: 'รูปใหญ่เกิน 5 MB', json_required: 'อัปโหลดไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่',
};

type Mode = 'code' | 'price';
interface Draft {
  id?: string; name: string; nameEn: string; detail: string; detailEn: string; mode: Mode; code: string; price: string; active: boolean;
  poster: string; file: Blob | null; preview: string; posterAuto: boolean;
}
const blank = (): Draft => ({ name: '', nameEn: '', detail: '', detailEn: '', mode: 'code', code: 'PAC-', price: '', active: true, poster: '', file: null, preview: '', posterAuto: false });
const fromRow = (r: PackageRow): Draft => ({
  id: r.id, name: r.name, nameEn: r.name_en, detail: r.detail, detailEn: r.detail_en, mode: r.code ? 'code' : 'price',
  code: r.code ?? '', price: r.price?.toString() ?? '', active: !!r.active, poster: r.poster, file: null, preview: r.poster, posterAuto: false,
});
const posterOf = (poster: string, ...names: string[]) => poster || names.map(posterFor).find(Boolean) || '';

async function toWebp(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/webp', 0.85));
}

export default function PackagesAdmin({ toast }: { toast: (m: string) => void }) {
  const [items, setItems] = useState<PackageRow[] | null>(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    api.packages().then(r => setItems(r.items)).catch(e => setErr((e as ApiError).code || 'network'));
    api.catalog().then(setCatalog).catch(() => undefined);
  }, []);

  // Sheet rows by code: every PAC-xx (catalog.pacs) plus single tests, so any sheet code can be linked.
  const sheet = useMemo(() => {
    const m = new Map<string, { name: string; price: number; detail: string }>();
    for (const p of catalog?.pacs ?? catalog?.packages ?? []) if (p.id) m.set(p.id, { name: p.name, price: p.price, detail: p.detail });
    for (const t of catalog?.tests ?? []) if (t.id && !m.has(t.id)) m.set(t.id, { name: t.n, price: t.p, detail: t.th });
    return m;
  }, [catalog]);
  const codeInfo = draft?.mode === 'code' ? sheet.get(draft.code.trim().toUpperCase()) : undefined;

  const run = async (f: () => Promise<{ items: PackageRow[] }>, ok: string) => {
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
    run(() => api.packageOrder(ids), 'บันทึกลำดับแล้ว');
  };
  const save = async () => {
    if (!draft) return;
    const d = draft;
    const data = {
      id: d.id, name: d.name, nameEn: d.nameEn, detail: d.detail, detailEn: d.detailEn, active: d.active,
      code: d.mode === 'code' ? d.code : '', price: d.mode === 'price' ? d.price : null, posterAuto: d.posterAuto && !d.file,
    };
    if (await run(() => api.savePackage(data, d.file), d.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มแพ็กเกจแล้ว')) setDraft(null);
  };
  const importSheet = async () => {
    setBusy(true);
    try {
      const r = await api.packagesImport();
      setItems(r.items);
      toast(r.added ? `เพิ่มแพ็กเกจใหม่จากชีต ${r.added} รายการ` : 'ไม่มีแพ็กเกจใหม่ในชีต');
    } catch (e) { toast('ดึงข้อมูลไม่สำเร็จ (' + ((e as ApiError).code || 'network') + ')'); }
    finally { setBusy(false); }
  };
  const pick = async (f: File | undefined) => {
    if (!f || !draft) return;
    try {
      const blob = await toWebp(f);
      setDraft({ ...draft, file: blob, preview: URL.createObjectURL(blob), posterAuto: false });
    } catch { toast('อ่านรูปไม่สำเร็จ กรุณาใช้ไฟล์ JPG หรือ PNG'); }
  };

  if (err) return <div style={card}>โหลดข้อมูลไม่สำเร็จ ({err})</div>;
  if (!items) return <div style={card}>กำลังโหลด…</div>;
  const shown = items.filter(x => x.active).length;
  const priceLabel = (r: PackageRow) => {
    if (r.code) {
      const s = sheet.get(r.code.toUpperCase());
      return s ? `${r.code} · ฿${fmt(s.price)}` : catalog ? `${r.code} · ⚠ ไม่พบในชีต${r.price ? ' · ใช้ ฿' + fmt(r.price) : ' จึงไม่แสดง'}` : r.code;
    }
    return r.price != null ? 'ราคากำหนดเอง · ฿' + fmt(r.price) : '—';
  };
  const autoPoster = draft ? posterOf('', draft.name, draft.nameEn, codeInfo?.name ?? '') : '';
  const draftPoster = draft ? (draft.file ? draft.preview : draft.posterAuto ? autoPoster : posterOf(draft.poster) || autoPoster) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#536C89', lineHeight: 1.55 }}>
          แสดงบนหน้าเว็บ <b style={{ color: '#0F2540' }}>{shown}</b> จาก {items.length} แพ็กเกจ · เรียงตามลำดับด้านล่าง · ราคาตามรหัสในชีตอัปเดตอัตโนมัติ · หน้าเว็บอัปเดตภายในประมาณ 1 นาที
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={importSheet} disabled={busy} style={btn}>ดึงแพ็กเกจใหม่จากชีต</button>
          <button onClick={() => setDraft(blank())} style={primary}>+ เพิ่มแพ็กเกจ</button>
        </span>
      </div>

      {draft && (
        <div style={{ ...card, border: '1.5px solid #1466C7', boxShadow: '0 0 0 4px rgba(20,102,199,.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{draft.id ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจใหม่'}</div>
            <span style={{ fontSize: 11.5, color: '#6B7F99', fontWeight: 600 }}>รูปเมื่อกด "ดูรายการตรวจ"</span>
            <label style={{ aspectRatio: '3 / 4', borderRadius: 14, border: '1.5px dashed #CFE0F1', background: '#F5F9FF', display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: 'pointer' }}>
              {draftPoster ? <img src={draftPoster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 12.5, color: '#536C89', textAlign: 'center', padding: 16 }}>คลิกเพื่อเลือกรูป<br />JPG / PNG · ระบบย่อรูปให้อัตโนมัติ</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: 11.5, color: '#7C93AD', lineHeight: 1.5 }}>
              คลิกที่รูปเพื่ออัปโหลดรูปใหม่ · ถ้าไม่อัปโหลด ระบบใช้รูปมาตรฐานตามชื่อแพ็กเกจ{!autoPoster && ' (ชื่อนี้ไม่มีรูปมาตรฐาน ปุ่มดูรายการตรวจจะไม่แสดง)'}
            </span>
            {(draft.file || (draft.poster && !draft.posterAuto)) && (
              <button type="button" onClick={() => setDraft({ ...draft, file: null, preview: '', posterAuto: true })} style={{ ...btn, alignSelf: 'start' }}>ใช้รูปมาตรฐานแทน</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
            <Field label="ชื่อ (ภาษาไทย) *"><input style={input} value={draft.name} maxLength={120} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="ชื่อ (English)"><input style={input} value={draft.nameEn} maxLength={120} onChange={e => setDraft({ ...draft, nameEn: e.target.value })} /></Field>
            <Field label="คำอธิบาย (ภาษาไทย)"><textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.detail} maxLength={400} onChange={e => setDraft({ ...draft, detail: e.target.value })} /></Field>
            <Field label="คำอธิบาย (English)"><textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.detailEn} maxLength={400} onChange={e => setDraft({ ...draft, detailEn: e.target.value })} /></Field>
            <Field group label="ราคาตรวจ">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['code', 'ตามรหัสใน Master Price List'], ['price', 'กำหนดราคาเอง']] as [Mode, string][]).map(([m, l]) => (
                  <button key={m} type="button" onClick={() => setDraft({ ...draft, mode: m })} style={draft.mode === m ? primary : btn}>{l}</button>
                ))}
              </div>
            </Field>
            {draft.mode === 'code' ? (
              <Field label="รหัสในชีต เช่น PAC-05 (ราคาเปลี่ยนตามชีตอัตโนมัติ)">
                <input style={input} value={draft.code} maxLength={20} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 5, color: codeInfo ? '#0B6E60' : '#A26A00' }}>
                  {draft.code.length > 4 ? (codeInfo ? `พบ: ${codeInfo.name} · ฿${fmt(codeInfo.price)}` : 'ไม่พบรหัสนี้ในชีต') : ''}
                  {codeInfo && (!draft.name || !draft.detail) && (
                    <button type="button" onClick={() => setDraft({ ...draft, name: draft.name || codeInfo.name, nameEn: draft.nameEn || codeInfo.name, detail: draft.detail || codeInfo.detail })} style={{ ...btn, padding: '4px 10px' }}>ใช้ชื่อและคำอธิบายจากชีต</button>
                  )}
                </span>
              </Field>
            ) : (
              <Field label="ราคา (บาท) *"><input style={{ ...input, maxWidth: 180 }} inputMode="numeric" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })} /></Field>
            )}
            {!draft.id && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
                <span>แสดงบนหน้าเว็บทันที</span>
              </label>
            )}
            <div style={{ fontSize: 11.5, color: '#7C93AD', lineHeight: 1.5 }}>ชื่อภาษาไทยใช้เป็นชื่อรายการในตะกร้าและใบนัด · การจองที่มีอยู่แล้วไม่เปลี่ยนตาม</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setDraft(null)} disabled={busy} style={btn}>ยกเลิก</button>
              <button type="button" onClick={save} disabled={busy} style={{ ...primary, opacity: busy ? .6 : 1 }}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {items.map((r, i) => {
          const poster = posterOf(r.poster, r.name, r.name_en, sheet.get((r.code || '').toUpperCase())?.name ?? '');
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #EEF3F9', opacity: r.active ? 1 : .55, flexWrap: 'wrap' }}>
              <span style={{ width: 48, height: 48, borderRadius: 10, background: '#EAF3FF', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 10, color: '#8FA6C0' }}>
                {poster ? <img src={poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'ไม่มีรูป'}
              </span>
              <span style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, marginRight: 8, background: r.active ? '#DFF5F0' : '#F0F4F9', color: r.active ? '#0B6E60' : '#5A7189' }}>{r.active ? `แสดง · ${items.filter(x => x.active).indexOf(r) + 1}` : 'ซ่อน'}</span>
                  {r.name}{r.name_en && r.name_en !== r.name ? <span style={{ fontWeight: 500, color: '#7C93AD' }}> · {r.name_en}</span> : null}
                </span>
                <span style={{ fontSize: 11.5, color: '#536C89', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail || '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0B4F9E' }}>{priceLabel(r)}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => run(() => api.packageActive(r.id, !r.active), r.active ? 'ซ่อนจากหน้าเว็บแล้ว' : 'แสดงบนหน้าเว็บแล้ว')} disabled={busy} style={r.active ? btn : primary}>{r.active ? 'ซ่อน' : 'แสดง'}</button>
                <button onClick={() => { setDraft(fromRow(r)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={busy} style={btn}>แก้ไข</button>
                <button onClick={() => move(i, -1)} disabled={busy || i === 0} style={{ ...btn, padding: '7px 10px' }} aria-label="เลื่อนขึ้น">↑</button>
                <button onClick={() => move(i, 1)} disabled={busy || i === items.length - 1} style={{ ...btn, padding: '7px 10px' }} aria-label="เลื่อนลง">↓</button>
                <button onClick={() => confirm('ลบ "' + r.name + '" ออกถาวร? (ถ้าเพียงไม่ต้องการแสดง ให้กด "ซ่อน")') && run(() => api.packageDelete(r.id), 'ลบแล้ว')} disabled={busy} style={{ ...btn, color: '#A3242A', borderColor: '#F3CFD1' }}>ลบ</button>
              </span>
            </div>
          );
        })}
        {!items.length && <div style={{ padding: 20, fontSize: 13, color: '#8FA6C0' }}>ยังไม่มีแพ็กเกจ · กด "ดึงแพ็กเกจใหม่จากชีต" เพื่อเริ่มจาก Master Price List</div>}
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
