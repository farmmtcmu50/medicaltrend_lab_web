// Google tag IDs for the customer pages, set in the Booking Console → Settings.
// Scope 'success': only /booking-success carries the tag. Scope 'all': every customer page (never /admin).
// Only IDs are stored, never pasted script: the Worker writes the standard Google snippet itself.

/** GA4 (G-), Google tag (GT-), Google Ads (AW-), Floodlight (DC-) or Tag Manager (GTM-). */
const TAG_ID = /^(G|GT|AW|DC|GTM)-[A-Z0-9]{4,20}$/;
export const MAX_TAG_IDS = 4;

export type TagCheck = { ok: true; ids: string[] } | { ok: false; error: 'tag_id' | 'too_many' };

/** Accepts IDs separated by commas, spaces or new lines; upper-cases and removes duplicates. */
export function parseTagIds(input: unknown): TagCheck {
  const raw = Array.isArray(input) ? input.join(',') : typeof input === 'string' ? input : '';
  const ids = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean))];
  if (ids.length > MAX_TAG_IDS) return { ok: false, error: 'too_many' };
  if (ids.some(id => !TAG_ID.test(id))) return { ok: false, error: 'tag_id' };
  return { ok: true, ids };
}

export type TagScope = 'all' | 'success';
export const parseScope = (v: unknown): TagScope => (v === 'all' ? 'all' : 'success');

/** Customer pages the Worker adds the tag to when the scope is 'all' (keep in sync with run_worker_first in wrangler.jsonc). */
export const TAGGED_PAGES = ['/', '/index.html', '/std', '/slip', '/booking-success'];
