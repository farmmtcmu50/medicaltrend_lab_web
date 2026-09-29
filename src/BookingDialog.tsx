// Contact details + PDPA consent, then POST /api/bookings. Not part of the original prototype:
// the design's STEP 5 button had no contact fields, so this dialog collects them in the same visual language.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { BranchId, PatientType, PersonSelection } from '../shared/catalog';
import type { Dict, Lang } from './i18n';
import * as ui from './ui';

export interface BookingDraft {
  mode: 'lab' | 'home';
  branch: BranchId;
  visitDate: string;
  slot: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  mapUrl: string | null;
  ref: string;
  patientType: PatientType;
  distanceKm: number;
  file: File | null;
  lang: Lang;
  persons: PersonSelection[];
  total: number;
}

interface Props {
  t: Dict;
  draft: BookingDraft;
  ctaLabel: string;
  onClose: () => void;
  onDone: () => void;
  onRepriced: () => Promise<unknown>;
}

export function BookingDialog({ t, draft, ctaLabel, onClose, onDone, onRepriced }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [line, setLine] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, sending]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = t.errName;
    const digits = phone.replace(/[^\d+]/g, '');
    if (!/^(\+66|0)\d{8,9}$/.test(digits)) e.phone = t.errPhone;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t.errEmail;
    if (!consent) e.consent = t.errPdpa;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (sending || !validate()) return;
    setSending(true);
    setServerError('');
    const payload = {
      mode: draft.mode,
      branch: draft.mode === 'lab' ? draft.branch : undefined,
      visitDate: draft.visitDate,
      slot: draft.slot,
      address: draft.mode === 'home' ? draft.address : undefined,
      lat: draft.mode === 'home' ? draft.coords?.lat ?? null : null,
      lng: draft.mode === 'home' ? draft.coords?.lng ?? null : null,
      mapUrl: draft.mode === 'home' ? draft.mapUrl : null,
      ref: draft.ref,
      patientType: draft.mode === 'home' ? draft.patientType : undefined,
      distanceKm: draft.mode === 'home' ? draft.distanceKm : undefined,
      persons: draft.persons,
      contact: { name: name.trim(), phone: phone.trim(), line: line.trim(), email: email.trim(), note: note.trim() },
      pdpaConsent: consent,
      expectedTotal: draft.total,
      lang: draft.lang,
    };
    const form = new FormData();
    form.set('payload', JSON.stringify(payload));
    if (draft.mode === 'home' && draft.file) form.set('labOrder', draft.file);

    try {
      const res = await fetch('/api/bookings', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ref) {
        setDoneRef(body.ref);
        onDone();
      } else if (res.status === 409) {
        await onRepriced();
        setServerError(body.error === 'price_changed' ? t.errPrice : t.errCatalog);
      } else {
        setServerError(t.errServer);
      }
    } catch {
      setServerError(t.errServer);
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={() => !sending && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(4,28,58,.72)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16, animation: 'riseIn .2s ease both', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bk-title" onClick={e => e.stopPropagation()}
        style={{ width: 'min(100%, 520px)', background: '#fff', borderRadius: 22, boxShadow: '0 40px 90px -30px rgba(0,0,0,.6)', overflow: 'hidden', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', borderBottom: '1px solid #EEF3F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...ui.stepBadge, color: '#062F63', background: '#4FE3C1' }}>STEP 5</span>
            <h2 id="bk-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>{doneRef ? t.doneH : t.contactH}</h2>
          </div>
          <button onClick={onClose} disabled={sending} aria-label={t.cancel} className="h-soft" style={{ width: 32, height: 32, border: 0, borderRadius: 10, background: '#EEF3F9', color: '#3D5674', fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {doneRef ? (
          <div style={{ padding: '28px 22px 24px', display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'center', alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E8F6F3', color: '#0E8C7C', display: 'grid', placeItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: '#6B7F99', marginBottom: 6 }}>{t.refLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '.02em', color: '#0B4F9E', fontFamily: "'IBM Plex Sans', sans-serif" }}>{doneRef}</div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#536C89', maxWidth: 380 }}>{t.doneP}</p>
            <button onClick={onClose} className="h-cta" style={{ ...primaryBtn, width: '100%' }}>{t.doneBtn}</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#536C89' }}>{t.contactP}</p>

            <Field id="bk-name" label={t.cName} error={errors.name}>
              <input ref={firstField} id="bk-name" className="f-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} style={inputStyle(!!errors.name)} />
            </Field>
            <Field id="bk-phone" label={t.cPhone} error={errors.phone}>
              <input id="bk-phone" className="f-input" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="08x xxx xxxx" maxLength={20} style={inputStyle(!!errors.phone)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
              <Field id="bk-line" label={t.cLine} hint={t.optional}>
                <input id="bk-line" className="f-input" value={line} onChange={e => setLine(e.target.value)} maxLength={80} style={inputStyle(false)} />
              </Field>
              <Field id="bk-email" label={t.cEmail} hint={t.optional} error={errors.email}>
                <input id="bk-email" className="f-input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={160} style={inputStyle(!!errors.email)} />
              </Field>
            </div>
            <Field id="bk-note" label={t.cNote} hint={t.optional}>
              <textarea id="bk-note" className="f-input" value={note} onChange={e => setNote(e.target.value)} placeholder={t.cNotePh} maxLength={1000} rows={2} style={{ ...inputStyle(false), resize: 'vertical' }} />
            </Field>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', border: '1.5px solid ' + (errors.consent ? '#E0A493' : '#DCE5EF'), background: consent ? '#F4FBF9' : '#F7FAFD' }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, width: 17, height: 17, accentColor: '#17A090', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.6, color: '#3D5674' }}>{t.pdpaText}</span>
            </label>
            {errors.consent && <div role="alert" style={errText}>{errors.consent}</div>}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 6, borderTop: '1px dashed #DCE5EF' }}>
              <span style={{ fontSize: 12.5, color: '#6B7F99' }}>{ctaLabel} · {draft.visitDate} {draft.slot}</span>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>฿{ui.fmt(draft.total)}</span>
            </div>
            {serverError && <div role="alert" style={{ ...errText, background: '#FFF1E8', border: '1px solid #F3CDB5', borderRadius: 10, padding: '10px 12px', color: '#9A5220' }}>{serverError}</div>}
            <button type="submit" disabled={sending} className="h-cta" style={{ ...primaryBtn, opacity: sending ? .7 : 1, cursor: sending ? 'wait' : 'pointer' }}>
              {sending ? t.sending : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={ui.label}>
        {label}{hint && <span style={{ fontWeight: 500, color: '#8FA6C0' }}> ({hint})</span>}
      </label>
      {children}
      {error && <div role="alert" style={errText}>{error}</div>}
    </div>
  );
}

const inputStyle = (bad: boolean): CSSProperties => ({
  width: '100%', padding: '12px 13px', border: '1.5px solid ' + (bad ? '#E0A493' : '#DCE5EF'), borderRadius: 12,
  fontSize: 14, color: '#0F2540', outline: 'none', background: '#fff',
});
const errText: CSSProperties = { fontSize: 11.5, color: '#B4432A', marginTop: 6, fontWeight: 500 };
const primaryBtn: CSSProperties = { border: 0, background: '#17B8A6', color: '#042F2A', fontSize: 16, fontWeight: 700, padding: 17, borderRadius: 14, cursor: 'pointer', transition: 'background .18s' };
