// Google Maps share links: recognise them and pull out coordinates / place name.
// Long links are parsed in the browser; short links (maps.app.goo.gl) are expanded
// by the Worker (/api/maps/resolve) because they need a redirect to be followed.

const MAP_HOSTS = [
  /^maps\.app\.goo\.gl$/, /^goo\.gl$/, /^g\.co$/,
  /^maps\.google\.[a-z.]+$/, /^(www\.)?google\.[a-z.]+$/,
];

export interface MapPoint { lat: number; lng: number; name: string | null }

/** First Google Maps URL found in free text (people often paste "Place name\nhttps://…"). */
export function findMapUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/);
  if (!m) return null;
  return isMapUrl(m[0]) ? m[0] : null;
}

export function isMapUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (!MAP_HOSTS.some(re => re.test(host))) return false;
    // google.com itself is only a maps link on /maps paths; short-link hosts always are.
    if (/google\./.test(host) && !host.startsWith('maps.')) return u.pathname.startsWith('/maps');
    if (host === 'goo.gl' || host === 'g.co') return u.pathname.startsWith('/maps') || u.pathname.startsWith('/kgs');
    return true;
  } catch {
    return false;
  }
}

export const isShortMapUrl = (raw: string) => {
  try { return /^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/i.test(new URL(raw).hostname); } catch { return false; }
};

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** Coordinates from an expanded Google Maps URL, most precise source first. */
export function parseMapUrl(raw: string): MapPoint | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const s = decodeURIComponent(u.href);

  let lat = NaN, lng = NaN;
  // Place marker: ...!3d18.7961!4d98.9679
  const pin = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) { lat = +pin[1]; lng = +pin[2]; }
  // ?q=18.79,98.96  /  ?query=  /  ?ll=  /  ?destination=
  if (!valid(lat, lng)) {
    for (const k of ['q', 'query', 'll', 'destination', 'daddr', 'center']) {
      const v = u.searchParams.get(k);
      const m = v && v.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) { lat = +m[1]; lng = +m[2]; break; }
    }
  }
  // /maps/search/18.79,+98.96  or  /maps/place/18.79,98.96
  if (!valid(lat, lng)) {
    const m = s.match(/\/maps\/(?:search|place|dir)\/[^/]*?(-?\d{1,2}\.\d+),\s*\+?(-?\d{1,3}\.\d+)/);
    if (m) { lat = +m[1]; lng = +m[2]; }
  }
  // Map view centre: /@18.79,98.96,17z (least precise, but usually right on the pin)
  if (!valid(lat, lng)) {
    const m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m) { lat = +m[1]; lng = +m[2]; }
  }
  if (!valid(lat, lng)) return null;

  let name: string | null = null;
  const place = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (place) {
    name = decodeURIComponent(place[1].replace(/\+/g, ' ')).trim();
    if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) name = null;
  }
  const q = u.searchParams.get('q');
  if (!name && q && !/^\s*-?\d/.test(q)) name = q.trim();

  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, name: name ? name.slice(0, 200) : null };
}

/** Canonical link staff can open, for pins that did not come from a pasted link. */
export const mapsLinkFor = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
