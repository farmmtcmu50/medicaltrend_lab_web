// Distance from a customer's location to the nearest branch, for home-collection travel fees.
//   GET /api/distance?lat=..&lng=..  → DistanceResult (or 503 when branch locations are unknown)
// Branch coordinates come from the branches' Google Maps links (shared/geo.ts), expanded once and kept
// in app_settings. Road distance is from the OSRM routing service; if it is unreachable the straight-line
// distance × ROAD_FACTOR is used. Results are edge-cached per location so the fee the customer sees is
// the fee the booking API recomputes a moment later.
import { BRANCH_IDS, type BranchId } from '../shared/catalog';
import { BRANCH_MAP_LINKS, ROAD_FACTOR, haversineKm, type DistanceResult, type LatLng } from '../shared/geo';
import { isMapUrl, isShortMapUrl, parseMapUrl, type MapPoint } from '../shared/maps';
import { json } from './util';

interface Env { DB: D1Database; BRANCH_POINTS?: string }

const POINTS_KEY = 'branch_points_v1';
const POINTS_TTL_MS = 30 * 86400_000;
const MAX_HOPS = 5;

/** Follows a Google Maps share link (every hop must stay on a Google Maps host) until it has coordinates. */
export async function expandMapLink(url: string): Promise<{ point: MapPoint | null; url: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const point = parseMapUrl(current);
    if (point) return { point, url: current };
    if (!isShortMapUrl(current) && hop > 0) break;
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MedicalTrendBooking/1.0)', 'accept-language': 'th,en;q=0.8' },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!res) throw new Error('fetch_failed');
    const next = res.headers.get('location');
    if (!next || res.status < 300 || res.status >= 400) break;
    const abs = new URL(next, current).href;
    if (!isMapUrl(abs)) {
      // Consent or unrelated pages: the original target is usually carried in ?continue=
      const cont = new URL(abs).searchParams.get('continue');
      if (cont && isMapUrl(cont)) { current = cont; continue; }
      break;
    }
    current = abs;
  }
  return { point: null, url: current };
}

/** Coordinates of every branch. Optional var BRANCH_POINTS='{"watket":[18.79,99.00],…}' overrides the links. */
export async function branchPoints(env: Env): Promise<Partial<Record<BranchId, LatLng>>> {
  const out: Partial<Record<BranchId, LatLng>> = {};
  if (env.BRANCH_POINTS) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(env.BRANCH_POINTS) as Record<string, [number, number]>)) {
        if ((BRANCH_IDS as readonly string[]).includes(k)) out[k as BranchId] = { lat: v[0], lng: v[1] };
      }
    } catch (e) { console.error('BRANCH_POINTS is not valid JSON', e); }
  }
  const row = await env.DB.prepare('SELECT value, updated_at FROM app_settings WHERE key = ?1')
    .bind(POINTS_KEY).first<{ value: string; updated_at: string }>().catch(() => null);
  const cached = row ? (JSON.parse(row.value) as Partial<Record<BranchId, LatLng>>) : {};
  const fresh = row && Date.now() - Date.parse(row.updated_at) < POINTS_TTL_MS;
  const missing = BRANCH_IDS.filter(id => !out[id] && !(fresh && cached[id]));
  if (missing.length) {
    const found = await Promise.all(missing.map(id => expandMapLink(BRANCH_MAP_LINKS[id]).then(r => r.point).catch(() => null)));
    missing.forEach((id, i) => { const p = found[i]; if (p) cached[id] = { lat: p.lat, lng: p.lng }; });
    if (missing.some((_, i) => found[i])) {
      await env.DB.prepare(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
        'ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      ).bind(POINTS_KEY, JSON.stringify(cached), new Date().toISOString()).run().catch(e => console.error('branch points save', e));
    }
  }
  for (const id of BRANCH_IDS) if (!out[id] && cached[id]) out[id] = cached[id];
  return out;
}

async function roadKm(from: LatLng, to: LatLng): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'user-agent': 'MedicalTrendBooking/1.0' } }).catch(() => null);
  if (!res || !res.ok) return null;
  const body = await res.json<{ code?: string; routes?: { distance: number }[] }>().catch(() => null);
  const m = body?.code === 'Ok' ? body.routes?.[0]?.distance : undefined;
  return typeof m === 'number' && m > 0 ? m / 1000 : null;
}

/** Nearest branch (straight line) and the road distance to it, whole km rounded up. Null if no branch is known. */
export async function distanceFrom(env: Env, ctx: ExecutionContext, at: LatLng): Promise<DistanceResult | null> {
  const lat = Math.round(at.lat * 1e5) / 1e5, lng = Math.round(at.lng * 1e5) / 1e5;
  const key = new Request(`https://distance.internal/v1/${lat},${lng}`);
  const hit = await caches.default.match(key);
  if (hit) return hit.json();

  const points = await branchPoints(env);
  let best: { id: BranchId; p: LatLng; d: number } | null = null;
  for (const id of BRANCH_IDS) {
    const p = points[id];
    if (!p) continue;
    const d = haversineKm({ lat, lng }, p);
    if (!best || d < best.d) best = { id, p, d };
  }
  if (!best) return null;

  const road = await roadKm({ lat, lng }, best.p);
  const result: DistanceResult = {
    ok: true, branch: best.id,
    km: Math.max(1, Math.ceil(road ?? best.d * ROAD_FACTOR)),
    method: road != null ? 'road' : 'straight',
  };
  ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' },
  })));
  return result;
}

export async function distanceResponse(url: URL, env: Env, ctx: ExecutionContext) {
  const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
  // Northern Thailand service area, loosely: anything else is a typo or a pasted link to elsewhere.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 5 || lat > 21 || lng < 97 || lng > 106) {
    return json({ error: 'bad_location' }, 400);
  }
  const r = await distanceFrom(env, ctx, { lat, lng });
  return r ? json(r) : json({ error: 'branches_unknown' }, 503);
}
