// Google Analytics / Google Ads tags on the customer pages.
//   GET  /, /std, /slip, /booking-success  pages served with the Google tag snippet in <head> (when IDs are set;
//                                         only /booking-success unless the scope is 'all')
//   GET  /api/admin/settings/analytics    current tag IDs + scope + who changed them last
//   POST /api/admin/settings/analytics    {"ids": "G-XXXX, AW-YYYY", "scope": "all" | "success"} ("" removes the tags)
// Stored in app_settings ('analytics'). The back office (/admin) never carries a tracking script.
import { parseScope, parseTagIds, TAGGED_PAGES, type TagScope } from '../shared/analytics';
import { json } from './util';

interface Env { DB: D1Database }
const KEY = 'analytics';

export interface AnalyticsSetting { ids: string[]; scope: TagScope; updatedAt: string | null; updatedBy: string | null }

export async function loadAnalyticsSetting(env: Env): Promise<AnalyticsSetting> {
  const row = await env.DB.prepare('SELECT value, updated_at FROM app_settings WHERE key = ?1').bind(KEY)
    .first<{ value: string; updated_at: string }>().catch(() => null);
  if (row) {
    try {
      const v = JSON.parse(row.value) as { ids?: unknown; scope?: unknown; by?: string };
      const ok = parseTagIds(v.ids);
      if (ok.ok) return { ids: ok.ids, scope: parseScope(v.scope), updatedAt: row.updated_at, updatedBy: v.by ?? null };
    } catch { /* treat as unset */ }
    console.error('analytics setting is invalid; no tags written');
  }
  return { ids: [], scope: 'success', updatedAt: null, updatedBy: null };
}

export async function handleAnalyticsAdmin(req: Request, env: Env, email: string): Promise<Response> {
  if (req.method === 'GET') return json(await loadAnalyticsSetting(env));
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  const body = await req.json<{ ids?: unknown; scope?: unknown }>().catch(() => null);
  if (!body) return json({ error: 'bad_request' }, 400);
  const v = parseTagIds(body.ids);
  if (!v.ok) return json({ error: v.error }, 400);
  if (!v.ids.length) await env.DB.prepare('DELETE FROM app_settings WHERE key = ?1').bind(KEY).run();
  else await env.DB.prepare(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
    'ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  ).bind(KEY, JSON.stringify({ ids: v.ids, scope: parseScope(body.scope), by: email }), new Date().toISOString()).run();
  return json(await loadAnalyticsSetting(env));
}

/** Google's standard snippets. IDs are validated against a strict pattern, so they are safe to inline. */
function headSnippet(ids: string[]): string {
  const gtm = ids.filter(id => id.startsWith('GTM-'));
  const gtag = ids.filter(id => !id.startsWith('GTM-'));
  let html = '<script>window.dataLayer=window.dataLayer||[];</script>';
  if (gtag.length) {
    html += `<script async src="https://www.googletagmanager.com/gtag/js?id=${gtag[0]}"></script>` +
      '<script>function gtag(){dataLayer.push(arguments);}gtag("js",new Date());' +
      gtag.map(id => `gtag("config","${id}");`).join('') + '</script>';
  }
  for (const id of gtm) {
    html += `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({"gtm.start":new Date().getTime(),event:"gtm.js"});` +
      `var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!="dataLayer"?"&l="+l:"";j.async=true;` +
      `j.src="https://www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);})(window,document,"script","dataLayer","${id}");</script>`;
  }
  return html;
}

export const isTaggedPage = (path: string) => TAGGED_PAGES.includes(path);

/** A customer page from static assets, with the Google tag added when the setting covers it. */
export async function taggedPage(req: Request, env: Env & { ASSETS: Fetcher }): Promise<Response> {
  const path = new URL(req.url).pathname;
  const success = path === '/booking-success';
  const { ids, scope } = await loadAnalyticsSetting(env);
  const tag = ids.length > 0 && (success || scope === 'all');
  // Fetch without conditional headers: the HTML changes with the setting, not with the deployed file (ETag).
  const page = await env.ASSETS.fetch(new Request(req.url, { method: req.method }));
  const res = new Response(page.body, page);
  res.headers.delete('etag');
  res.headers.set('cache-control', 'no-cache');
  if (success) res.headers.set('x-robots-tag', 'noindex');
  if (!tag || !(page.headers.get('content-type') || '').includes('text/html')) return res;
  return new HTMLRewriter().on('head', { element: el => { el.prepend(headSnippet(ids), { html: true }); } }).transform(res);
}
