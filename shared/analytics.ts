// Google tag IDs for the booking-success page (/booking-success), set in the Booking Console → Settings.
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
