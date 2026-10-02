// Home-collection fee rules from GET /api/pricing (set in the Booking Console). Until they arrive the
// built-in defaults are shown; the booking API re-prices with the live rules either way.
import { useEffect, useState } from 'react';
import { DEFAULT_HOME_PRICING, validateHomePricing, type HomePricing } from '../shared/catalog';

let cached: HomePricing | null = null;
let pending: Promise<HomePricing> | null = null;

export function fetchHomePricing(fresh = false): Promise<HomePricing> {
  if (cached && !fresh) return Promise.resolve(cached);
  if (!pending || fresh) {
    pending = fetch('/api/pricing', fresh ? { cache: 'no-store' } : undefined)
      .then(r => r.json())
      .then(raw => { const v = validateHomePricing(raw); cached = v.ok ? v.pricing : DEFAULT_HOME_PRICING; return cached; })
      .catch(() => { pending = null; return cached ?? DEFAULT_HOME_PRICING; });
  }
  return pending;
}

export function useHomePricing(): HomePricing {
  const [hp, setHp] = useState<HomePricing>(cached ?? DEFAULT_HOME_PRICING);
  useEffect(() => { let live = true; fetchHomePricing().then(p => { if (live) setHp(p); }); return () => { live = false; }; }, []);
  return hp;
}
