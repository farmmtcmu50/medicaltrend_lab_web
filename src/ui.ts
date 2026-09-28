// Style builders for stateful controls, ported from the prototype's renderVals().
import type { CSSProperties } from 'react';

export const fmt = (n: number) => n.toLocaleString('en-US');

export const langBtn = (on: boolean): CSSProperties => ({
  border: 0, borderRadius: 999, padding: '7px 11px', fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
  cursor: 'pointer', transition: 'all .16s',
  ...(on ? { background: '#0B4F9E', color: '#fff' } : { background: 'transparent', color: '#5B7391' }),
});

export const modeTab = (active: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 10px', border: 0,
  borderRadius: 11, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
  ...(active
    ? { background: '#0B4F9E', color: '#fff', boxShadow: '0 8px 18px -10px rgba(11,79,158,.9)' }
    : { background: 'transparent', color: '#5B7391' }),
});

export const patientChip = (active: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '11px 6px', borderRadius: 12,
  cursor: 'pointer', transition: 'all .18s',
  ...(active
    ? { border: '1.5px solid #17B8A6', background: '#E8F6F3', color: '#0A6E62' }
    : { border: '1.5px solid #DCE5EF', background: '#fff', color: '#3D5674' }),
});

export const personChip = (on: boolean): CSSProperties => ({
  fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 999, cursor: 'pointer',
  border: '1.5px solid ' + (on ? '#1466C7' : '#DCE5EF'), background: on ? '#1466C7' : '#fff', color: on ? '#fff' : '#3D5674',
});

export const personTab = (on: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 14px', borderRadius: 12,
  cursor: 'pointer', transition: 'all .16s',
  ...(on
    ? { border: '1.5px solid #1466C7', background: '#1466C7', color: '#fff' }
    : { border: '1.5px solid #DCE5EF', background: '#fff', color: '#3D5674' }),
});

export const pkgRow = (on: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, width: '100%', padding: '14px 16px',
  borderRadius: 13, cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
  ...(on
    ? { border: '1.5px solid #1466C7', background: '#F1F7FF', color: '#0B4F9E' }
    : { border: '1.5px solid #E4ECF5', background: '#fff', color: '#0F2540' }),
});

export const noPkgBtn = (on: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, width: '100%', marginBottom: 12,
  padding: '14px 16px', borderRadius: 13, cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
  ...(on
    ? { border: '1.5px solid #17B8A6', background: '#E8F6F3', color: '#0A6E62' }
    : { border: '1.5px dashed #C6D6E8', background: '#F7FAFD', color: '#3D5674' }),
});

export const uploadBtn = (has: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%', padding: '15px 16px',
  borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
  ...(has
    ? { border: '1.5px dashed #17B8A6', background: '#E8F6F3', color: '#0A6E62' }
    : { border: '1.5px dashed #C6D6E8', background: '#F7FAFD', color: '#3D5674' }),
});

export const catChip = (on: boolean): CSSProperties => ({
  padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .16s',
  ...(on
    ? { border: '1.5px solid #1466C7', background: '#1466C7', color: '#fff' }
    : { border: '1.5px solid #DCE5EF', background: '#fff', color: '#3D5674' }),
});

export const popularCard = (on: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', background: '#fff', border: '1.5px solid ' + (on ? '#1466C7' : '#E4ECF5'),
  borderRadius: 18, overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s',
  boxShadow: on ? '0 22px 44px -28px rgba(11,79,158,.45)' : '0 1px 0 rgba(4,28,58,.03)',
});

export const popularBtn = (on: boolean): CSSProperties => ({
  border: '1.5px solid ' + (on ? '#1466C7' : '#CFE0F1'), background: on ? '#1466C7' : '#fff', color: on ? '#fff' : '#0B4F9E',
  fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
});

export const tierBtn = (on: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
  border: '1.5px solid ' + (on ? '#1466C7' : '#CFE0F1'), background: on ? '#F1F7FF' : '#fff', color: on ? '#0B4F9E' : '#3D5674',
});

export const testToggle = (on: boolean): CSSProperties => ({
  width: 30, height: 30, border: 0, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 600,
  cursor: 'pointer', transition: 'all .16s',
  ...(on ? { background: '#17B8A6', color: '#fff' } : { background: '#EEF3F9', color: '#0B4F9E' }),
});

export const syncBadge = (state: 'loading' | 'live' | 'offline'): CSSProperties => ({
  padding: '4px 10px', borderRadius: 999, fontWeight: 600, fontSize: 11.5,
  ...(state === 'live' ? { background: '#E8F6F3', color: '#0A6E62' }
    : state === 'loading' ? { background: '#EAF3FF', color: '#0B4F9E' }
      : { background: '#FFF1E8', color: '#9A5220' }),
});

// Shared static styles
export const label: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3D5674', marginBottom: 7 };
export const field: CSSProperties = { width: '100%', padding: 12, border: '1.5px solid #DCE5EF', borderRadius: 12, fontSize: 13.5, color: '#0F2540', outline: 'none', background: '#fff' };
export const stepBadge: CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: '#fff', background: '#0B4F9E', padding: '5px 10px', borderRadius: 999 };
export const eyebrow: CSSProperties = { fontSize: 12.5, fontWeight: 600, letterSpacing: '.14em', color: '#17A090', textTransform: 'uppercase' };
export const h2Big: CSSProperties = { fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.12 };
export const h2Step: CSSProperties = { fontSize: 'clamp(26px, 2.6vw, 34px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.15 };
export const lede: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.65, color: '#536C89', textWrap: 'pretty' };
export const wrap: CSSProperties = { maxWidth: 1200, margin: '0 auto' };
