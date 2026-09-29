// Booking Console (/admin). Visual language from project/Admin Console.dc.html;
// this first version covers the views backed by real data: overview, booking list and booking detail.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BRANCH_IDS } from '../../shared/catalog';
import {
  BRANCH_NAMES, PATIENT_LABELS, STATUSES, STATUS_FLOW, STATUS_META,
  type AdminBooking, type AdminRow, type AdminSummary, type Status,
} from '../../shared/admin';
import { refLabel } from '../../shared/ref';
import { api, ApiError, type ListQuery } from './api';
import ItemEditor from './ItemEditor';

const fmt = (n: number | null | undefined) => (n || 0).toLocaleString('en-US');
const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const thDate = (ymd: string) => new Date(ymd + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const thDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const branchLabel = (mode: string, branch: string | null) => mode === 'home' ? 'บริการถึงบ้าน' : BRANCH_NAMES[branch as keyof typeof BRANCH_NAMES] || '—';

const pill = (m: { c: string; bg: string }): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, padding: '6px 10px',
  borderRadius: 999, whiteSpace: 'nowrap', color: m.c, background: m.bg,
});
const channelPill = (mode: string) => pill(mode === 'home' ? { c: '#0B6E60', bg: '#DFF5F0' } : { c: '#0B4F9E', bg: '#EAF3FF' });
const stdPill = pill({ c: '#7A3E9D', bg: '#F4EAFB' });
const rxPill = pill({ c: '#A26A00', bg: '#FFF4E0' });
const card: CSSProperties = { background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 20 };
const cardTitle: CSSProperties = { fontSize: 14, fontWeight: 700, letterSpacing: '-.01em' };
const outlineBtn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 999, cursor: 'pointer' };

type Route = { view: 'dash' } | { view: 'bookings' } | { view: 'detail'; ref: string };
function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('b/')) return { view: 'detail', ref: decodeURIComponent(h.slice(2)) };
  if (h === 'bookings') return { view: 'bookings' };
  return { view: 'dash' };
}
const go = (hash: string) => { location.hash = hash; };

export default function AdminApp() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [me, setMe] = useState<string>('');
  const [authError, setAuthError] = useState('');
  const [toast, setToast] = useState('');
  const [filters, setFilters] = useState<ListQuery>({ status: 'all', branch: 'all', source: 'all', q: '', from: '', to: '', page: 1 });

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    api.me().then(r => setMe(r.email)).catch(e => setAuthError(e instanceof ApiError ? e.code : 'network'));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const openList = (patch: Partial<ListQuery>) => {
    setFilters(f => ({ ...f, status: 'all', from: '', to: '', ...patch, page: 1 }));
    go('/bookings');
  };

  const views: Record<Route['view'], [string, string]> = {
    dash: ['ภาพรวมวันนี้', 'สรุปคิว รายได้ และงานค้างของทุกสาขา · ข้อมูลจากหน้าเว็บจอง lab.medicaltrend.stream'],
    bookings: ['รายการจองทั้งหมด', 'ค้นหา กรองตามสถานะ สาขา และวันนัด แล้วกดเปิดเพื่อจัดการรายการนั้น'],
    detail: ['รายละเอียดการจอง', 'ตรวจรายการของผู้รับบริการแต่ละคน ยืนยันนัด อัปเดตสถานะ และบันทึกหมายเหตุ'],
  };
  const [title, sub] = views[route.view];

  if (authError) {
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 520, margin: '12vh auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>เข้าหน้าหลังบ้านไม่ได้</div>
          <div style={{ fontSize: 13, color: '#536C89', lineHeight: 1.6 }}>
            {authError === 'access_not_configured'
              ? 'ยังไม่ได้ตั้งค่า Cloudflare Access (ACCESS_TEAM_DOMAIN / ACCESS_AUD) ใน wrangler.jsonc'
              : authError === 'access_aud_invalid'
                ? 'ค่า ACCESS_AUD ไม่ใช่ AUD Tag (ต้องเป็นตัวอักษร 64 ตัวไม่มีขีด ไม่ใช่ Application ID) กรุณาตรวจใน Zero Trust → Applications → Overview'
              : authError === 'email_not_allowed'
                ? 'อีเมลนี้ไม่ได้รับสิทธิ์เข้าหลังบ้าน'
                : 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง'}
          </div>
          <a href="/cdn-cgi/access/logout" style={{ fontSize: 13, fontWeight: 600 }}>ออกจากระบบ / เปลี่ยนบัญชี</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <aside className="a-aside" style={{ flex: '1 1 236px', maxWidth: 262, background: 'linear-gradient(185deg, #062F63 0%, #08417F 55%, #0B4F9E 100%)', color: '#fff', padding: '22px 16px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px' }}>
          <img src="/img/logo-mt-company.webp" alt="เมดิคอลเทรนด์" style={{ height: 38, width: 'auto', display: 'block', background: '#fff', borderRadius: 9, padding: 4 }} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em' }}>Booking Console</span>
            <span style={{ fontSize: 10.5, color: '#9FC2E0' }}>เมดิคอลเทรนด์ · หลังบ้าน</span>
          </span>
        </div>
        <nav className="a-aside-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <NavBtn on={route.view === 'dash'} label="ภาพรวมวันนี้" onClick={() => go('/')} />
          <NavBtn on={route.view !== 'dash'} label="รายการจอง" onClick={() => go('/bookings')} />
          <a href="/" target="_blank" rel="noopener" className="a-nav" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500, padding: '11px 12px', borderRadius: 11, color: '#DCEBFA' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'rgba(255,255,255,.3)' }} />หน้าเว็บจอง ↗
          </a>
        </nav>
        <div className="a-aside-foot" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: '#4FE3C1', color: '#062F63', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(me || '?').slice(0, 2).toUpperCase()}</span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me || '…'}</span>
              <a href="/cdn-cgi/access/logout" style={{ fontSize: 10.5, color: '#9FC2E0' }}>ออกจากระบบ</a>
            </span>
          </div>
        </div>
      </aside>

      <main className="a-main" style={{ flex: '1 1 560px', minWidth: 0, padding: '22px clamp(16px, 2.4vw, 32px) 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(21px, 2.2vw, 27px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.2 }}>{title}</h1>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: '#536C89', lineHeight: 1.5 }}>{sub}</p>
          </div>
          {route.view === 'bookings' && (
            <>
              <label style={{ flex: '0 1 250px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '9px 12px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C93AD" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
                <input type="search" aria-label="ค้นหา" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value, page: 1 }))} placeholder="ค้นหารหัส ชื่อ เบอร์โทร" style={{ border: 0, outline: 'none', width: '100%', fontSize: 13, color: '#0F2540', background: 'transparent' }} />
              </label>
              <select aria-label="สาขา" value={filters.branch} onChange={e => setFilters(f => ({ ...f, branch: e.target.value, page: 1 }))} style={{ flex: '0 1 220px', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, background: '#fff', color: '#0F2540' }}>
                <option value="all">ทุกสาขา / ทุกช่องทาง</option>
                {BRANCH_IDS.map(id => <option key={id} value={id}>{BRANCH_NAMES[id]}</option>)}
                <option value="home">บริการเจาะเลือดถึงบ้าน</option>
              </select>
              <select aria-label="หน้าเว็บที่จอง" value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value, page: 1 }))} style={{ flex: '0 1 170px', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, background: '#fff', color: '#0F2540' }}>
                <option value="all">ทุกหน้าเว็บ</option>
                <option value="web">หน้าจองหลัก</option>
                <option value="std">หน้า STD (/std)</option>
              </select>
            </>
          )}
        </div>

        {route.view === 'dash' && <Dashboard openList={openList} />}
        {route.view === 'bookings' && <BookingList filters={filters} setFilters={setFilters} />}
        {route.view === 'detail' && <BookingDetail key={route.ref} ref_={route.ref} toast={setToast} />}
      </main>

      {toast && (
        <div role="status" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 50, background: '#0F2540', color: '#fff', fontSize: 13, fontWeight: 500, padding: '12px 16px', borderRadius: 12, boxShadow: '0 18px 40px -18px rgba(4,28,58,.6)', animation: 'fadeUp .2s ease both', maxWidth: 'calc(100vw - 40px)' }}>{toast}</div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', sans-serif", color: '#0F2540', background: '#EEF3F9', minHeight: '100vh', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>{children}</div>;
}

function NavBtn({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="a-nav" aria-current={on ? 'page' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', fontSize: 13, fontWeight: on ? 700 : 500, padding: '11px 12px', borderRadius: 11, color: on ? '#062F63' : '#DCEBFA', background: on ? '#fff' : 'transparent' }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: on ? '#4FE3C1' : 'rgba(255,255,255,.3)', flexShrink: 0 }} />
      {label}
    </button>
  );
}

function Loading({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', color: error ? '#A3242A' : '#7C93AD', fontSize: 13 }}>
      {error ? <>โหลดข้อมูลไม่สำเร็จ ({error}) {retry && <button onClick={retry} style={{ ...outlineBtn, marginLeft: 8 }}>ลองใหม่</button>}</> : 'กำลังโหลด…'}
    </div>
  );
}

// ------------------------------------------------------------------ overview

function Dashboard({ openList }: { openList: (p: Partial<ListQuery>) => void }) {
  const [s, setS] = useState<AdminSummary | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { setErr(''); api.summary().then(setS).catch(e => setErr(e.code || 'network')); }, []);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);
  if (!s) return <Loading error={err} retry={load} />;

  const kpis = [
    { label: 'นัดวันนี้', value: fmt(s.visitsToday), delta: 'เจาะที่บ้าน ' + s.homeVisitsToday + ' · ที่แล็บ ' + (s.visitsToday - s.homeVisitsToday), color: '#0F7A6B' },
    { label: 'รอยืนยัน (ทั้งหมด)', value: fmt(s.pending), delta: s.pending ? 'ต้องโทรยืนยันนัด' : 'ไม่มีงานค้าง', color: s.pending ? '#A26A00' : '#0F7A6B', go: () => openList({ status: 'pending' }) },
    { label: 'จองใหม่วันนี้', value: fmt(s.newToday), delta: 'ผ่านหน้าเว็บ', color: '#0B4F9E' },
    { label: 'ยอดนัดเดือนนี้', value: '฿' + fmt(s.monthRevenue), delta: s.monthBookings + ' รายการ (ไม่รวมยกเลิก)', color: '#0B4F9E' },
  ];
  const maxRev = Math.max(1, ...s.revenueByBranch.map(r => r.amount));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .25s ease both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(196px, 100%), 1fr))', gap: 14 }}>
        {kpis.map(k => (
          <button key={k.label} onClick={k.go} disabled={!k.go} className={k.go ? 'a-pale' : undefined} style={{ ...card, padding: '18px 18px 16px', borderRadius: 16, textAlign: 'left', cursor: k.go ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
            <div style={{ fontSize: 11.5, color: '#7C93AD', letterSpacing: '.04em', fontWeight: 500 }}>{k.label}</div>
            <div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>{k.value}</div>
            <div style={{ marginTop: 7, fontSize: 11.5, color: k.color, fontWeight: 600 }}>{k.delta}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={cardTitle}>รายได้ต่อสาขา · เดือนนี้ (ตามวันนัด)</div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {s.revenueByBranch.length === 0 && <Empty>ยังไม่มีการจองในเดือนนี้</Empty>}
            {s.revenueByBranch.map(r => (
              <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                  <span style={{ color: '#3D5674', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.key === 'home' ? 'บริการถึงบ้าน' : BRANCH_NAMES[r.key as keyof typeof BRANCH_NAMES] || r.key} · {r.count}</span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>฿{fmt(r.amount)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#EEF3F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (r.amount / maxRev * 100) + '%', borderRadius: 999, background: r.key === 'home' ? '#17A090' : '#1466C7' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>แพ็กเกจ/รายการขายดี · 30 วัน</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
            {s.topItems.length === 0 && <Empty>ยังไม่มีข้อมูล</Empty>}
            {s.topItems.map((t, i) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #EEF3F9' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: '#EAF3FF', color: '#0B4F9E', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                </span>
                <span style={{ fontSize: 12, color: '#536C89', whiteSpace: 'nowrap' }}>{t.count} ครั้ง · ฿{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>ที่มาของการจอง · 30 วัน</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
            {s.referrers.length === 0 && <Empty>ยังไม่มีข้อมูล</Empty>}
            {s.referrers.map(r => (
              <div key={r.source + (r.referrer || '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #EEF3F9' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span style={{ ...(r.source === 'std' ? stdPill : pill({ c: '#0B4F9E', bg: '#EAF3FF' })), padding: '3px 8px', fontSize: 10.5 }}>{r.source === 'std' ? 'STD' : 'หลัก'}</span>
                  <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLabel(r.referrer)}</span>
                </span>
                <span style={{ fontSize: 12, color: '#536C89', whiteSpace: 'nowrap' }}>{r.count} รายการ · ฿{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={cardTitle}>นัดวันนี้แยกตามสถานะ · {thDate(s.today)}</div>
          <button onClick={() => openList({ from: s.today, to: s.today })} className="a-pale" style={outlineBtn}>ดูนัดวันนี้ทั้งหมด</button>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(148px, 100%), 1fr))', gap: 10 }}>
          {(['pending', 'confirmed', 'assigned', 'enroute', 'collected', 'result'] as Status[]).map(k => (
            <button key={k} onClick={() => openList({ status: k, from: s.today, to: s.today })} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'start', padding: 14, borderRadius: 13, cursor: 'pointer', border: '1.5px solid ' + STATUS_META[k].bg, background: STATUS_META[k].bg, color: STATUS_META[k].c, font: 'inherit' }}>
              <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>{s.statusToday[k] || 0}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{STATUS_META[k].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12.5, color: '#8FA6C0', padding: '8px 0' }}>{children}</div>;

// ------------------------------------------------------------------ list

function BookingList({ filters, setFilters }: { filters: ListQuery; setFilters: (f: (p: ListQuery) => ListQuery) => void }) {
  const [data, setData] = useState<{ rows: AdminRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api.list(filters).then(setData).catch(e => setErr(e.code || 'network'));
  }, [filters]);
  useEffect(() => { const id = setTimeout(load, filters.q ? 250 : 0); return () => clearTimeout(id); }, [load, filters.q]);

  const set = (patch: Partial<ListQuery>) => setFilters(f => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const chip = (on: boolean): CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', border: '1.5px solid ' + (on ? '#1466C7' : '#DFE8F2'), background: on ? '#1466C7' : '#fff', color: on ? '#fff' : '#536C89' });
  const dateInput: CSSProperties = { border: '1.5px solid #DFE8F2', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, background: '#fff', color: '#0F2540' };
  const today = bkkToday();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .25s ease both' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', ...STATUSES] as const).map(k => (
          <button key={k} onClick={() => set({ status: k })} style={chip(filters.status === k)} aria-pressed={filters.status === k}>{k === 'all' ? 'ทั้งหมด' : STATUS_META[k].label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#536C89' }}>
        <span>วันนัด</span>
        <input type="date" aria-label="ตั้งแต่วันที่" value={filters.from} onChange={e => set({ from: e.target.value })} style={dateInput} />
        <span>ถึง</span>
        <input type="date" aria-label="ถึงวันที่" value={filters.to} onChange={e => set({ to: e.target.value })} style={dateInput} />
        <button onClick={() => set({ from: today, to: today })} className="a-pale" style={{ ...outlineBtn, padding: '7px 12px' }}>วันนี้</button>
        <button onClick={() => set({ from: today, to: '' })} className="a-pale" style={{ ...outlineBtn, padding: '7px 12px' }}>ตั้งแต่วันนี้</button>
        {(filters.from || filters.to) && <button onClick={() => set({ from: '', to: '' })} style={{ border: 0, background: 'transparent', color: '#7C93AD', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>ล้างวันที่</button>}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 940 }}>
            <div className="a-grid" style={{ padding: '13px 20px', background: '#F7FAFD', borderBottom: '1px solid #E4ECF5', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: '#7C93AD' }}>
              <span>รหัสจอง</span><span>ลูกค้า</span><span>ช่องทาง</span><span>สาขา</span><span>วัน · เวลา</span>
              <span style={{ textAlign: 'center' }}>คน</span><span style={{ textAlign: 'right' }}>ยอดรวม</span><span>สถานะ</span><span />
            </div>
            {!data && <div style={{ padding: 24 }}><Loading error={err} retry={load} /></div>}
            {data && data.rows.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#8FA6C0' }}>ไม่พบรายการจองตามเงื่อนไข</div>}
            {data?.rows.map(r => (
              <div key={r.ref} className="a-grid a-row" onClick={() => go('/b/' + r.ref)} style={{ padding: '15px 20px', borderBottom: '1px solid #F1F5FA', alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                <span style={{ fontWeight: 700, color: '#0B4F9E', fontFeatureSettings: "'tnum'", fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.ref}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.contact_name}</span>
                  <span style={{ fontSize: 11, color: '#7C93AD' }}>{r.contact_phone}</span>
                </span>
                <span style={r.source === 'std' ? stdPill : channelPill(r.mode)}>{r.source === 'std' ? 'STD' : r.mode === 'home' ? 'เจาะที่บ้าน' : 'ที่แล็บ'}</span>
                <span style={{ color: '#3D5674', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branchLabel(r.mode, r.branch)}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{thDate(r.visit_date)}</span>
                  <span style={{ fontSize: 11, color: '#7C93AD' }}>{r.slot}</span>
                </span>
                <span style={{ textAlign: 'center', fontWeight: 600 }}>{r.people}</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{r.rx_pending ? <span style={{ ...rxPill, padding: '4px 8px', fontSize: 10.5 }}>รอแจ้งราคา</span> : '฿' + fmt(r.total)}</span>
                <span style={pill(STATUS_META[r.status])}>{STATUS_META[r.status].label}</span>
                <a href={'#/b/' + r.ref} onClick={e => e.stopPropagation()} className="a-pale" style={{ border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 11.5, fontWeight: 700, padding: '7px 10px', borderRadius: 9, textAlign: 'center' }}>เปิด</a>
              </div>
            ))}
          </div>
        </div>
        {data && (
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#7C93AD' }}>
            <span>แสดง {data.rows.length ? (data.page - 1) * data.pageSize + 1 : 0}–{(data.page - 1) * data.pageSize + data.rows.length} จาก {fmt(data.total)} รายการ</span>
            <span style={{ display: 'flex', gap: 7 }}>
              <button disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 })} style={{ border: '1.5px solid #DFE8F2', background: '#fff', color: '#536C89', fontSize: 12, padding: '7px 13px', borderRadius: 9, cursor: data.page <= 1 ? 'default' : 'pointer', opacity: data.page <= 1 ? .5 : 1 }}>ก่อนหน้า</button>
              <button disabled={data.page * data.pageSize >= data.total} onClick={() => set({ page: data.page + 1 })} style={{ border: '1.5px solid #DFE8F2', background: '#fff', color: '#536C89', fontSize: 12, padding: '7px 13px', borderRadius: 9, cursor: data.page * data.pageSize >= data.total ? 'default' : 'pointer', opacity: data.page * data.pageSize >= data.total ? .5 : 1 }}>ถัดไป</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ detail

function BookingDetail({ ref_: ref, toast }: { ref_: string; toast: (m: string) => void }) {
  const [b, setB] = useState<AdminBooking | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => {
    setErr('');
    api.get(ref).then(x => { setB(x); setNote(x.staff_note || ''); }).catch(e => setErr(e.code || 'network'));
  }, [ref]);
  useEffect(() => { load(); }, [load]);

  const back = (
    <button onClick={() => history.length > 1 ? history.back() : go('/bookings')} style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, background: 'transparent', color: '#0B4F9E', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m11 19-7-7 7-7" /></svg>
      กลับไปรายการจอง
    </button>
  );
  if (!b) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{back}<Loading error={err === 'not_found' ? 'ไม่พบรายการ' : err} retry={load} /></div>;

  const setStatus = async (to: Status) => {
    if (busy || to === b.status) return;
    if (to === 'cancelled' && !confirm('ยืนยันยกเลิกการจอง ' + b.ref + ' ?')) return;
    setBusy(true);
    try { setB(await api.setStatus(b.ref, to)); toast(b.ref + ' → ' + STATUS_META[to].label); }
    catch (e) { toast('บันทึกไม่สำเร็จ (' + ((e as ApiError).code || 'network') + ')'); }
    finally { setBusy(false); }
  };
  const saveNote = async () => {
    setBusy(true);
    try { const x = await api.setNote(b.ref, note); setB(x); setNote(x.staff_note || ''); toast('บันทึกหมายเหตุแล้ว'); }
    catch (e) { toast('บันทึกไม่สำเร็จ (' + ((e as ApiError).code || 'network') + ')'); }
    finally { setBusy(false); }
  };

  const persons = Array.from({ length: b.people }, (_, i) => b.items.filter(it => it.person_no === i + 1));
  const isHome = b.mode === 'home';
  const mapUrl = b.map_url ? b.map_url : b.latitude != null && b.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`
    : b.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.address) : '';
  const facts: [string, ReactNode][] = [
    ['ลูกค้า', b.contact_name],
    ['เบอร์ติดต่อ', <a href={'tel:' + b.contact_phone}>{b.contact_phone}</a>],
    ['วัน เวลา', thDate(b.visit_date) + ' · ' + b.slot],
    [isHome ? 'ช่องทาง' : 'สาขา', branchLabel(b.mode, b.branch)],
    ...(isHome ? [
      ['ที่อยู่เข้าบริการ', <>{b.address}{mapUrl && <> · <a href={mapUrl} target="_blank" rel="noopener">{b.map_url ? 'ลิงก์ Google Maps จากลูกค้า ↗' : 'แผนที่ ↗'}</a></>}{b.latitude != null && <span style={{ display: 'block', fontSize: 11, color: '#7C93AD', fontWeight: 500 }}>{b.latitude}, {b.longitude}</span>}</>],
      ['ประเภทผู้รับบริการ · ระยะทาง', (PATIENT_LABELS[b.patient_type || ''] || '—') + ' · ' + b.distance_km + ' กม.' + (b.branch ? ' จาก' + (BRANCH_NAMES[b.branch as keyof typeof BRANCH_NAMES] || b.branch) : ' (ลูกค้าประมาณเอง)')],
    ] as [string, ReactNode][] : []),
    ['LINE ID', b.contact_line || '—'],
    ['อีเมล', b.contact_email ? <a href={'mailto:' + b.contact_email}>{b.contact_email}</a> : '—'],
    ['จองเมื่อ', thDateTime(b.created_at)],
    ['ที่มา', (b.source === 'std' ? 'หน้า STD · ' : 'หน้าหลัก · ') + refLabel(b.referrer)],
    ['ใบสั่งตรวจจากแพทย์', b.has_lab_order ? <a href={api.labOrderUrl(b.ref)} target="_blank" rel="noopener">{b.lab_order_name || 'เปิดไฟล์'} ↗</a> : 'ไม่มี'],
  ];

  const flowIndex = (STATUS_FLOW as readonly string[]).indexOf(b.status);
  const reachedAt = (k: string) => {
    const e = [...b.events].reverse().find(x => (x.action === 'status' && x.to_status === k) || (k === 'pending' && x.action === 'created'));
    return e ? thDateTime(e.at) : '';
  };
  const actions: [string, Status][] = [['ยืนยันนัด', 'confirmed'], ['จ่ายงาน', 'assigned'], ['กำลังเดินทาง', 'enroute'], ['บันทึกว่าเจาะแล้ว', 'collected'], ['ส่งแล็บ', 'lab'], ['ผลออกแล้ว', 'result'], ['ปิดงาน', 'done'], ['ยกเลิก', 'cancelled']];
  const shownActions = isHome ? actions : actions.filter(([, k]) => k !== 'assigned' && k !== 'enroute');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .25s ease both' }}>
      {back}
      <div style={{ ...card, borderRadius: 20, padding: 22, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'start' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', fontFamily: "'IBM Plex Sans', sans-serif" }}>{b.ref}</span>
            <span style={pill(STATUS_META[b.status])}>{STATUS_META[b.status].label}</span>
            <span style={channelPill(b.mode)}>{isHome ? 'เจาะที่บ้าน' : 'ที่แล็บ'}</span>
            {b.source === 'std' && <span style={stdPill}>จองจากหน้า STD</span>}
            {b.has_lab_order && !b.items.length && <span style={rxPill}>ใบสั่งแพทย์ · รอแจ้งค่าตรวจ</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '12px 18px', fontSize: 12.5 }}>
            {facts.map(([label, value]) => (
              <span key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, wordBreak: 'break-word' }}>
                <span style={{ fontSize: 11, color: '#7C93AD' }}>{label}</span>
                <span style={{ fontWeight: 600, lineHeight: 1.45 }}>{value}</span>
              </span>
            ))}
          </div>
          {b.note && (
            <div style={{ fontSize: 12.5, lineHeight: 1.55, background: '#FFF8EA', border: '1px solid #F3E2BD', borderRadius: 12, padding: '10px 12px', color: '#6B5210' }}>
              <b>หมายเหตุจากลูกค้า:</b> {b.note}
            </div>
          )}
        </div>
        <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, color: '#7C93AD', letterSpacing: '.04em' }}>เปลี่ยนสถานะ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {shownActions.map(([label, k]) => (
              <button key={k} disabled={busy} onClick={() => setStatus(k)} aria-pressed={b.status === k}
                style={{ fontSize: 12, fontWeight: 700, padding: '9px 13px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', border: '1.5px solid', ...(k === 'cancelled' ? { borderColor: '#F3CFD1', background: '#fff', color: '#A3242A' } : b.status === k ? { borderColor: '#1466C7', background: '#1466C7', color: '#fff' } : { borderColor: '#CFE0F1', background: '#fff', color: '#0B4F9E' }) }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#7C93AD', letterSpacing: '.04em' }}>ติดต่อลูกค้า</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <a href={'tel:' + b.contact_phone} style={contactBtn}>โทร {b.contact_phone}</a>
            {b.contact_email && <a href={'mailto:' + b.contact_email + '?subject=' + encodeURIComponent('ยืนยันการจอง ' + b.ref)} style={contactBtn}>อีเมล</a>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {editing ? (
            <ItemEditor b={b} toast={toast} onCancel={() => setEditing(false)} onConflict={() => { setEditing(false); load(); }}
              onSaved={x => { setB(x); setEditing(false); }} />
          ) : (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={cardTitle}>ผู้รับบริการ {b.people} คน</span>
              {b.status !== 'cancelled' && <button onClick={() => setEditing(true)} className="a-pale" style={outlineBtn}>แก้ไขรายการตรวจ</button>}
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {persons.map((items, i) => (
                <div key={i} style={{ border: '1.5px solid #E9F0F8', borderRadius: 14, padding: 14, background: '#FBFDFF' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>คนที่ {i + 1}</div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                    {!items.length && <span style={{ color: '#A26A00' }}>{b.has_lab_order ? 'ตรวจตามใบสั่งแพทย์ · กด "แก้ไขรายการตรวจ" เพื่อใส่รายการและราคา' : 'ยังไม่มีรายการ'}</span>}
                    {items.map((it, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: '#3D5674', lineHeight: 1.45 }}>{it.kind === 'package' ? '📦 ' : ''}{it.name}</span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>฿{fmt(it.price)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px dashed #DFE8F2', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 11.5, color: '#7C93AD' }}>{items.filter(x => x.kind === 'package').length} แพ็กเกจ · {items.filter(x => x.kind === 'test').length} รายการเดี่ยว</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0B4F9E', whiteSpace: 'nowrap' }}>฿{fmt(items.reduce((a, x) => a + x.price, 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          <div style={card}>
            <div style={cardTitle}>หมายเหตุเจ้าหน้าที่</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="เช่น โทรยืนยันแล้ว ลูกค้าขอเลื่อนเป็น 07:00, ผู้ป่วยใช้รถเข็น" style={{ marginTop: 12, width: '100%', border: '1.5px solid #DFE8F2', borderRadius: 11, padding: '10px 12px', fontSize: 13, resize: 'vertical', color: '#0F2540' }} />
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveNote} disabled={busy || note === (b.staff_note || '')} className="a-pale" style={{ ...outlineBtn, opacity: busy || note === (b.staff_note || '') ? .5 : 1 }}>บันทึกหมายเหตุ</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(170deg, #062F63, #0B4F9E 65%, #106B94)', color: '#fff', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#9FC2E0', letterSpacing: '.04em' }}>สรุปค่าบริการ</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11, fontSize: 13 }}>
              {persons.map((items, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
                  <span style={{ color: '#DCEBFA' }}>คนที่ {i + 1}</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>฿{fmt(items.reduce((a, x) => a + x.price, 0))}</span>
                </div>
              ))}
              {isHome && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
                  <span style={{ color: '#DCEBFA' }}>ค่าบริการถึงบ้าน ({b.distance_km} กม. · {b.people} ท่าน)</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{b.travel_fee ? '฿' + fmt(b.travel_fee) : 'ฟรี'}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11.5, color: '#9FC2E0' }}>ยอดรวมทั้งสิ้น</span>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1 }}>฿{fmt(b.total)}</span>
              </span>
              <span style={{ fontSize: 11, color: '#9FC2E0', textAlign: 'right', lineHeight: 1.5 }}>ราคาจาก {b.price_source === 'live' ? 'ชีตล่าสุด' : 'ชุดสำรอง'}<br />PDPA ยินยอม {thDateTime(b.pdpa_consent_at)}</span>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>ไทม์ไลน์งาน</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
              {STATUS_FLOW.filter(k => isHome || (k !== 'assigned' && k !== 'enroute')).map((k, i, arr) => {
                const done = b.status !== 'cancelled' && flowIndex >= (STATUS_FLOW as readonly string[]).indexOf(k);
                const current = b.status === k;
                return (
                  <div key={k} style={{ display: 'flex', gap: 13, alignItems: 'start' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, marginTop: 3, background: done ? (current ? '#1466C7' : '#17A090') : '#fff', border: '2px solid ' + (done ? (current ? '#1466C7' : '#17A090') : '#CFE0F1'), boxShadow: current ? '0 0 0 4px rgba(20,102,199,.15)' : 'none' }} />
                      {i < arr.length - 1 && <span style={{ width: 2, height: 26, background: done ? '#BFE5DE' : '#E4ECF5' }} />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: done ? '#0F2540' : '#8FA6C0' }}>{STATUS_META[k].label}</span>
                      <span style={{ fontSize: 11.5, color: '#8FA6C0' }}>{done ? reachedAt(k) : ''}</span>
                    </span>
                  </div>
                );
              })}
              {b.status === 'cancelled' && <div style={{ ...pill(STATUS_META.cancelled), alignSelf: 'start' }}>ยกเลิกแล้ว · {reachedAt('cancelled')}</div>}
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>ประวัติการแก้ไข</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[...b.events].reverse().map((e, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.5, paddingBottom: 9, borderBottom: '1px solid #F1F5FA' }}>
                  <div style={{ color: '#0F2540', fontWeight: 600 }}>
                    {e.action === 'created' ? 'ลูกค้าจองผ่านหน้าเว็บ'
                      : e.action === 'status' ? (STATUS_META[e.from_status as Status]?.label || e.from_status) + ' → ' + (STATUS_META[e.to_status as Status]?.label || e.to_status)
                        : e.action === 'items' ? 'แก้ไขรายการตรวจ: ' + (e.note || '')
                          : 'แก้หมายเหตุ' + (e.note ? ': ' + e.note : ' (ลบ)')}
                  </div>
                  <div style={{ color: '#8FA6C0' }}>{thDateTime(e.at)} · {e.actor === 'customer' ? 'ลูกค้า' : e.actor}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const contactBtn: CSSProperties = { fontSize: 12, fontWeight: 700, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #DFE8F2', background: '#F7FAFD', color: '#3D5674' };
