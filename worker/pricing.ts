// Home-collection fee rules (distance tiers, people covered, extra-person fee), set in the Booking Console.
//   GET  /api/pricing                         public: what the booking pages use to show the fee
//   GET  /api/admin/settings                  current rules + who changed them last
//   POST /api/admin/settings/home-pricing     {"pricing": HomePricing} or {"reset": true}
// Stored in app_settings ('home_pricing'). Bookings keep the fee they were made with; new rules apply to
// new bookings and to fees staff re-compute (pin moved, number of people changed).
import { DEFAULT_HOME_PRICING, validateHomePricing, type HomePricing } from '../shared/catalog';
import { json } from './util';

interface Env { DB: D1Database }
const KEY = 'home_pricing';

export interface PricingSetting { pricing: HomePricing; isDefault: boolean; updatedAt: string | null; updatedBy: string | null }

export async function loadPricingSetting(env: Env): Promise<PricingSetting> {
  const row = await env.DB.prepare('SELECT value, updated_at FROM app_settings WHERE key = ?1').bind(KEY)
    .first<{ value: string; updated_at: string }>().catch(() => null);
  if (row) {
    try {
      const v = JSON.parse(row.value) as { pricing?: unknown; by?: string };
      const ok = validateHomePricing(v.pricing);
      if (ok.ok) return { pricing: ok.pricing, isDefault: false, updatedAt: row.updated_at, updatedBy: v.by ?? null };
    } catch { /* fall back to defaults */ }
    console.error('home_pricing setting is invalid; using defaults');
  }
  return { pricing: DEFAULT_HOME_PRICING, isDefault: true, updatedAt: null, updatedBy: null };
}

export const loadHomePricing = async (env: Env) => (await loadPricingSetting(env)).pricing;

export async function pricingResponse(env: Env) {
  // Short browser cache: a change in the Console reaches open pages within a minute,
  // and the booking API re-prices anyway (price_changed).
  return json(await loadHomePricing(env), 200, { 'cache-control': 'public, max-age=60' });
}

/** Admin routes under /api/admin/settings (parts = path after /api/admin). */
export async function handleSettingsAdmin(req: Request, env: Env, email: string, parts: string[]): Promise<Response> {
  if (req.method === 'GET' && parts.length === 1) return json(await loadPricingSetting(env));
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'home-pricing') {
    const body = await req.json<{ pricing?: unknown; reset?: unknown }>().catch(() => null);
    if (!body) return json({ error: 'bad_request' }, 400);
    if (body.reset === true) {
      await env.DB.prepare('DELETE FROM app_settings WHERE key = ?1').bind(KEY).run();
      return json(await loadPricingSetting(env));
    }
    const v = validateHomePricing(body.pricing);
    if (!v.ok) return json({ error: 'bad_request', detail: v.error }, 400);
    await env.DB.prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
      'ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    ).bind(KEY, JSON.stringify({ pricing: v.pricing, by: email }), new Date().toISOString()).run();
    return json(await loadPricingSetting(env));
  }
  return json({ error: 'not_found' }, 404);
}
