// Address / Google Maps link / "pin my location" handling for home collection, plus the distance to the
// nearest branch from GET /api/distance. Used by the /std booking form (the main page has the same flow inline).
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_HOME_PRICING, PRICING, maxKm, type HomePricing } from '../shared/catalog';
import type { DistanceResult } from '../shared/geo';
import { findMapUrl, isShortMapUrl, mapsLinkFor, parseMapUrl } from '../shared/maps';

export type MapLink = { url: string; status: 'resolving' | 'ok' | 'nocoords'; fromPin?: boolean };
export type DistInfo = { status: 'loading' | 'fail' } | (DistanceResult & { status: 'ok' }) | null;

export function useHomeLocation(active: boolean, labels: { pinned: string; fromMaps: string }, hp: HomePricing = DEFAULT_HOME_PRICING) {
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLink, setMapLink] = useState<MapLink | null>(null);
  const [locating, setLocating] = useState(false);
  const [distance, setDistance] = useState(5);
  const [distInfo, setDistInfo] = useState<DistInfo>(null);
  const req = useRef(0);

  useEffect(() => {
    if (!active || !coords) { setDistInfo(null); return; }
    let live = true;
    setDistInfo({ status: 'loading' });
    fetch(`/api/distance?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.json().catch(() => ({})))
      .then((r: Partial<DistanceResult>) => {
        if (!live) return;
        if (r.ok && typeof r.km === 'number' && r.branch && r.method) {
          setDistInfo({ status: 'ok', ok: true, km: r.km, branch: r.branch, method: r.method });
          setDistance(Math.min(Math.max(r.km, PRICING.minKm), maxKm(hp)));
        } else setDistInfo({ status: 'fail' });
      })
      .catch(() => { if (live) setDistInfo({ status: 'fail' }); });
    return () => { live = false; };
  }, [active, coords, hp]);

  const onAddressChange = (text: string) => {
    const url = findMapUrl(text);
    if (!url) {
      setAddress(text);
      if (!mapLink) setCoords(null);
      return;
    }
    const rest = text.replace(url, ' ').replace(/\s+/g, ' ').trim();
    const n = ++req.current;
    const apply = (lat: number, lng: number, name: string | null) => {
      if (n !== req.current) return;
      setCoords({ lat, lng });
      setMapLink({ url, status: 'ok' });
      setAddress(a => a || name || labels.fromMaps);
    };
    setAddress(rest);
    const direct = parseMapUrl(url);
    if (direct) { apply(direct.lat, direct.lng, direct.name); return; }
    setMapLink({ url, status: isShortMapUrl(url) ? 'resolving' : 'nocoords' });
    if (!rest) setAddress(labels.fromMaps);
    if (!isShortMapUrl(url)) return;
    fetch('/api/maps/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      .then(r => r.json().catch(() => ({})))
      .then((r: { ok?: boolean; lat?: number; lng?: number; name?: string | null }) => {
        if (n !== req.current) return;
        if (r.ok && typeof r.lat === 'number' && typeof r.lng === 'number') {
          apply(r.lat, r.lng, r.name ?? null);
          if (r.name && !rest) setAddress(r.name);
        } else setMapLink({ url, status: 'nocoords' });
      })
      .catch(() => { if (n === req.current) setMapLink({ url, status: 'nocoords' }); });
  };

  const pin = (onFail: () => void) => {
    if (!navigator.geolocation) { onFail(); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        req.current++;
        setCoords({ lat, lng });
        setAddress(a => a || labels.pinned + ' · ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
        setMapLink({ url: mapsLinkFor(+lat.toFixed(6), +lng.toFixed(6)), status: 'ok', fromPin: true });
        setLocating(false);
      },
      () => { setLocating(false); onFail(); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const clearLink = () => { req.current++; setMapLink(null); setCoords(null); };
  const reset = () => { req.current++; setAddress(''); setCoords(null); setMapLink(null); setDistInfo(null); setDistance(5); };
  const outOfArea = active && distInfo?.status === 'ok' && distInfo.km > maxKm(hp);

  return { address, setAddress, coords, mapLink, locating, distance, setDistance, distInfo, outOfArea, onAddressChange, pin, clearLink, reset };
}
