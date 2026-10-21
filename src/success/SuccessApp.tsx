// /booking-success — thank-you page the booking forms open after a booking is saved.
// It has its own URL so Google Analytics / Ads can count it as a conversion: the Worker adds the Google tag
// to this page only (IDs set in Booking Console → Settings), and the page reports one generate_lead event per booking.
// Only the booking reference, mode and amount travel in the URL; no name, phone or test names go to Google.
import { useEffect, type CSSProperties } from 'react';

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

const font = "'IBM Plex Sans Thai', 'Sarabun', 'Tahoma', sans-serif";
const btn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', height: 50, borderRadius: 999, fontSize: 15.5, fontWeight: 600, textDecoration: 'none', fontFamily: font };

const q = new URLSearchParams(location.search);
const ref = (q.get('booking') || '').toUpperCase();
const validRef = /^[A-Z0-9-]{6,24}$/.test(ref);
const mode = q.get('mode') === 'home' ? 'home' : 'lab';
const source = q.get('src') === 'std' ? 'std' : 'main';
const en = q.get('lang') === 'en';
const value = Math.max(0, Math.round(Number(q.get('value')) || 0));
const L = (th: string, eng: string) => (en ? eng : th);

/** One conversion per booking, even if the page is reloaded or reopened from history. */
function reportConversion() {
  if (!validRef || !window.dataLayer) return;
  const key = 'mt_conv_' + ref;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { /* storage blocked: report anyway */ }
  const params = { currency: 'THB', value, transaction_id: ref, booking_mode: mode, booking_source: source };
  window.gtag?.('event', 'generate_lead', params);
  window.dataLayer.push({ event: 'booking_success', booking_ref: ref, ...params });
}

export default function SuccessApp() {
  useEffect(() => { reportConversion(); document.documentElement.lang = en ? 'en' : 'th'; }, []);
  const home = source === 'std' ? '/std' : '/';

  return (
    <main style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #EAF3FC 0%, #F7FAFD 60%)', fontFamily: font, color: '#0F2540', display: 'grid', placeItems: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(100%, 480px)', background: '#fff', borderRadius: 24, border: '1px solid #E4ECF5', boxShadow: '0 30px 60px -36px rgba(4,28,58,.45)', padding: '32px 24px 26px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <a href={home} aria-label="Medical Trend"><img src="/img/logo-mt-center.webp" alt="Medical Trend Lab Group" style={{ height: 44, width: 'auto' }} /></a>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8F6F3', color: '#0E8C7C', display: 'grid', placeItems: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{L('การจองสำเร็จ', 'Booking received')}</h1>

        {validRef && (
          <div>
            <div style={{ fontSize: 13, color: '#6B7F99', marginBottom: 6 }}>{L('เลขที่การจอง', 'Booking reference')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '.02em', color: '#0B4F9E', fontFamily: "'IBM Plex Sans', sans-serif" }}>{ref}</div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: '#536C89' }}>
          {mode === 'home'
            ? L('เจ้าหน้าที่จะโทรยืนยันนัดเจาะเลือดถึงบ้านที่เบอร์ของคุณ หลังยืนยันแล้วเราจะส่งอีเมลพร้อมลิงก์พิมพ์ใบนัด', 'Our staff will call you to confirm the home visit. Once confirmed, we will email you a link to print your appointment slip.')
            : L('เจ้าหน้าที่จะโทรยืนยันนัดที่เบอร์ของคุณ กรุณาเก็บเลขที่การจองไว้อ้างอิง', 'Our staff will call your number to confirm. Please keep your booking reference.')}
        </p>

        {validRef && mode === 'lab' && (
          <a href={'/slip?ref=' + encodeURIComponent(ref)} target="_blank" rel="noopener" style={{ ...btn, background: '#1466C7', color: '#fff' }}>🖨 {L('พิมพ์ใบนัดหมาย', 'Print your appointment slip')}</a>
        )}
        <a href={home} style={{ ...btn, border: '1.5px solid #CFE0F1', color: '#0B4F9E', background: '#fff' }}>{L('กลับหน้าหลัก', 'Back to home page')}</a>

        <div style={{ fontSize: 13, color: '#7C93AD' }}>{L('สอบถามเพิ่มเติม โทร ', 'Questions? Call ')}<a href="tel:0952472631" style={{ color: '#0B4F9E', fontWeight: 600 }}>095-247-2631</a></div>
      </div>
    </main>
  );
}
