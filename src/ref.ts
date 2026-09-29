// Browser side of booking attribution (see shared/ref.ts).
import { cleanRef } from '../shared/ref';

/** Browser side: read ?ref / ?utm_source, else the referring site, else "direct". Remembered for the tab session. */
export function detectRef(storageKey: string): string {
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(storageKey); } catch { /* storage blocked */ }
  const q = new URLSearchParams(location.search);
  let ref = cleanRef(q.get('ref')) || cleanRef(q.get('utm_source'));
  if (!ref) {
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      if (host && host !== location.hostname) ref = cleanRef('ext:' + host);
    } catch { /* bad referrer */ }
  }
  ref = ref || saved || 'direct';
  try { sessionStorage.setItem(storageKey, ref); } catch { /* ignore */ }
  return ref;
}
