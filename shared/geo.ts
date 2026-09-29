// Branch locations and distance helpers for home-collection pricing.
// Branch coordinates are read by the Worker from these Google Maps links (see worker/geo.ts),
// so moving a branch only means updating its link here.
import { BRANCH_IDS, type BranchId } from './catalog';

export const BRANCH_MAP_LINKS: Record<BranchId, string> = {
  sankamphaeng: 'https://maps.app.goo.gl/dHaP2e7HRyN2FW7V6',
  hangdong: 'https://maps.app.goo.gl/y9izRjZqGh4rdBw3A',
  watket: 'https://maps.app.goo.gl/fLN92AkvcfVXRNn7A',
  phayao: 'https://maps.app.goo.gl/tDfmQh4GsNK9HKAbA',
};
export const BRANCH_LINK_LIST = BRANCH_IDS.map(id => BRANCH_MAP_LINKS[id]);

export interface LatLng { lat: number; lng: number }

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line km → typical road km in Chiang Mai / Phayao, used only when routing is unavailable. */
export const ROAD_FACTOR = 1.35;

/** Result of GET /api/distance, also recomputed by the Worker when a booking is saved. */
export interface DistanceResult {
  ok: true;
  branch: BranchId;
  km: number;               // whole km, rounded up — what the travel fee is charged on
  method: 'road' | 'straight';
}
