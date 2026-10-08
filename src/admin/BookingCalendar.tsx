// Calendar view of the booking list: a month grid by visit date plus the agenda of the chosen day.
// Uses the same filters as the list (status, branch, page, search); the month replaces the date range.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { STATUSES, STATUS_META, whereShort, type AdminRow } from '../../shared/admin';
import { api, type ListQuery } from './api';

const fmt = (n: number) => n.toLocaleString('en-US');
const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00+07:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
const dayLabel = (s: string) => new Date(s + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
export const shiftMonth = (ym: string, n: number) => { const d = new Date(ym + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return ymd(d).slice(0, 7); };
const slotStart = (slot: string) => slot.slice(0, 5);

/** Sunday-first 6-week grid (or 5 when the month fits) covering the month. */
function gridDays(ym: string): string[] {
  const first = ym + '-01';
  const start = addDays(first, -new Date(first + 'T00:00:00Z').getUTCDay());
  const lastOfMonth = addDays(shiftMonth(ym, 1) + '-01', -1);
  const weeks = Math.ceil(((Date.parse(lastOfMonth) - Date.parse(start)) / 86_400_000 + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

const pill = (m: { c: string; bg: string }): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 999, whiteSpace: 'nowrap', color: m.c, background: m.bg,
});
const navBtn: CSSProperties = { border: '1.5px solid #DFE8F2', background: '#fff', color: '#0B4F9E', fontSize: 13, fontWeight: 700, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const outlineBtn: CSSProperties = { border: '1.5px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 999, cursor: 'pointer' };

export default function BookingCalendar({ filters, setFilters, month, setMonth, day, setDay, open }: {
  filters: ListQuery; setFilters: (f: (p: ListQuery) => ListQuery) => void;
  month: string; setMonth: (m: string) => void; day: string; setDay: (d: string) => void;
  open: (ref: string) => void;
}) {
  const days = useMemo(() => gridDays(month), [month]);
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api.calendar(filters, days[0], days[days.length - 1]).then(r => setRows(r.rows)).catch(e => setErr(e.code || 'network'));
  }, [filters, days]);
  useEffect(() => { const id = setTimeout(load, filters.q ? 250 : 0); return () => clearTimeout(id); }, [load, filters.q]);
  useEffect(() => { const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, AdminRow[]>();
    for (const r of rows ?? []) { const a = m.get(r.visit_date); if (a) a.push(r); else m.set(r.visit_date, [r]); }
    return m;
  }, [rows]);
  const today = bkkToday();
  const chip = (on: boolean): CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', border: '1.5px solid ' + (on ? '#1466C7' : '#DFE8F2'), background: on ? '#1466C7' : '#fff', color: on ? '#fff' : '#536C89' });
  const active = (r: AdminRow) => r.status !== 'cancelled';
  const monthRows = (rows ?? []).filter(r => r.visit_date.startsWith(month) && active(r));
  const dayRows = byDay.get(day) ?? [];
  const goToday = () => { setMonth(today.slice(0, 7)); setDay(today); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .25s ease both' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', ...STATUSES] as const).map(k => (
          <button key={k} onClick={() => setFilters(f => ({ ...f, status: k, page: 1 }))} style={chip(filters.status === k)} aria-pressed={filters.status === k}>{k === 'all' ? 'ทั้งหมด' : STATUS_META[k].label}</button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #E4ECF5' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn} aria-label="เดือนก่อนหน้า">‹</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn} aria-label="เดือนถัดไป">›</button>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', minWidth: 150 }}>{monthLabel(month)}</span>
          <button onClick={goToday} className="a-pale" style={{ ...outlineBtn, padding: '7px 12px' }}>วันนี้</button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#536C89' }}>
            {rows ? <>เดือนนี้ <b style={{ color: '#0F2540' }}>{monthRows.length}</b> นัด · {fmt(monthRows.reduce((a, r) => a + r.people, 0))} คน · ฿{fmt(monthRows.reduce((a, r) => a + r.total, 0))} <span style={{ color: '#8FA6C0' }}>(ไม่รวมยกเลิก)</span></> : err ? <span style={{ color: '#A3242A' }}>โหลดไม่สำเร็จ ({err}) <button onClick={load} style={{ ...outlineBtn, padding: '4px 10px' }}>ลองใหม่</button></span> : 'กำลังโหลด…'}
          </span>
        </div>

        <div className="a-cal" role="grid" aria-label={'ปฏิทินนัด ' + monthLabel(month)}>
          {WEEKDAYS.map((w, i) => <div key={w} className="a-cal-head" style={{ color: i === 0 ? '#A3242A' : '#7C93AD' }}>{w}</div>)}
          {days.map(d => {
            const list = byDay.get(d) ?? [];
            const live = list.filter(active);
            const inMonth = d.startsWith(month);
            const sel = d === day;
            return (
              <button key={d} role="gridcell" aria-selected={sel} onClick={() => setDay(d)}
                className={'a-cal-cell' + (inMonth ? '' : ' a-cal-out') + (sel ? ' a-cal-sel' : '') + (d === today ? ' a-cal-today' : '')}
                aria-label={dayLabel(d) + ' · ' + live.length + ' นัด'}>
                <span className="a-cal-num">
                  <span className="a-cal-date">{Number(d.slice(8))}</span>
                  {live.length > 0 && <span className="a-cal-count">{live.length} นัด</span>}
                </span>
                <span className="a-cal-items">
                  {list.slice(0, 3).map(r => (
                    <span key={r.ref} className="a-cal-item" style={{ borderLeftColor: STATUS_META[r.status].c, background: STATUS_META[r.status].bg, textDecoration: active(r) ? 'none' : 'line-through', opacity: active(r) ? 1 : .6 }}>
                      {slotStart(r.slot)} {r.mode === 'home' ? '🏠 ' : ''}{r.contact_name}
                    </span>
                  ))}
                  {list.length > 3 && <span className="a-cal-more">+{list.length - 3} รายการ</span>}
                </span>
                {live.length > 0 && <span className="a-cal-dots" aria-hidden="true">{live.slice(0, 4).map(r => <i key={r.ref} style={{ background: STATUS_META[r.status].c }} />)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>นัด{dayLabel(day)}</span>
          <span style={{ fontSize: 12, color: '#536C89' }}>{dayRows.filter(active).length} นัด · {dayRows.filter(active).reduce((a, r) => a + r.people, 0)} คน</span>
        </div>
        {rows && dayRows.length === 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: '#8FA6C0' }}>ไม่มีนัดในวันนี้ตามเงื่อนไขที่เลือก</div>}
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
          {[...new Set(dayRows.map(r => r.slot))].sort((x, y) => slotStart(x).localeCompare(slotStart(y)) || x.localeCompare(y)).map(slot => {
            const inSlot = dayRows.filter(r => r.slot === slot);
            if (!inSlot.length) return null;
            return (
              <div key={slot} style={{ paddingTop: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7C93AD', letterSpacing: '.04em', marginBottom: 6 }}>{slot} · {inSlot.length} นัด</div>
                {inSlot.map(r => (
                  <div key={r.ref} className="a-row" onClick={() => open(r.ref)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') open(r.ref); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '11px 12px', borderRadius: 12, cursor: 'pointer', border: '1px solid #EEF3F9', marginBottom: 6, opacity: active(r) ? 1 : .6 }}>
                    <span style={{ fontWeight: 700, color: '#0B4F9E', fontSize: 12.5, fontFamily: "'IBM Plex Sans', sans-serif", minWidth: 110 }}>{r.ref}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: '1 1 160px', minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.contact_name}</span>
                      <span style={{ fontSize: 11, color: '#7C93AD' }}>{r.contact_phone}</span>
                    </span>
                    <span style={pill(r.mode === 'home' ? { c: '#0B6E60', bg: '#DFF5F0' } : { c: '#0B4F9E', bg: '#EAF3FF' })}>{whereShort(r.mode, r.branch)}</span>
                    {r.source === 'std' && <span style={pill({ c: '#7A3E9D', bg: '#F4EAFB' })}>STD</span>}
                    <span style={{ fontSize: 12, color: '#536C89', whiteSpace: 'nowrap' }}>{r.people} คน</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>{r.rx_pending ? <span style={pill({ c: '#A26A00', bg: '#FFF4E0' })}>รอแจ้งราคา</span> : '฿' + fmt(r.total)}</span>
                    <span style={pill(STATUS_META[r.status])}>{STATUS_META[r.status].label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
