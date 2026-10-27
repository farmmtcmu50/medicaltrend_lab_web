// Google Analytics / Google Ads tags on the customer pages.
//   GET  /, /std, /slip, /booking-success  pages served with the Google tag snippet in <head> (when IDs are set;
//                                         only /booking-success unless the scope is 'all')
//   GET  /api/admin/settings/analytics    current tag IDs + scope + who changed them last
//   POST /api/admin/settings/analytics    {"ids": "G-XXXX, AW-YYYY", "scope": "all" | "success"} ("" removes the tags)
// Stored in app_settings ('analytics'). The back office (/admin) never carries a tracking script.
// Consent (PDPA): Google Consent Mode v2 starts every storage type as denied; the cookie banner added to each
// tagged page grants analytics/ads storage only after the visitor accepts. The choice is kept in localStorage
// ('mt_cookie_consent') and can be changed from any link to #cookie-settings.
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
  // Consent defaults must reach the dataLayer before any tag loads.
  let html = '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
    'gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",wait_for_update:500});' +
    'try{if(localStorage.getItem("mt_cookie_consent")==="granted")gtag("consent","update",{ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted",analytics_storage:"granted"});}catch(e){}' +
    '</script>';
  if (gtag.length) {
    html += `<script async src="https://www.googletagmanager.com/gtag/js?id=${gtag[0]}"></script>` +
      '<script>gtag("js",new Date());' +
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
  return new HTMLRewriter()
    .on('head', { element: el => { el.prepend(headSnippet(ids), { html: true }); } })
    .on('body', { element: el => { el.append(COOKIE_BANNER, { html: true }); } })
    .transform(res);
}

/**
 * Cookie banner (Thai / English from the site's language setting, else ?lang). Shown until the visitor chooses;
 * "accept" and "decline" are equally prominent. Any <a href="#cookie-settings"> reopens it.
 */
const COOKIE_BANNER = `<div id="mt-cc" role="dialog" aria-live="polite" aria-label="Cookies" hidden>
<style>
#mt-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;display:flex;justify-content:center;font-family:'IBM Plex Sans Thai','Sarabun','Tahoma',sans-serif}
#mt-cc[hidden]{display:none}
#mt-cc .b{width:min(100%,760px);box-sizing:border-box;background:#fff;color:#0F2540;border:1px solid #D5E0EC;border-radius:18px;box-shadow:0 24px 60px -24px rgba(4,28,58,.55);padding:18px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
#mt-cc .t{flex:1 1 320px;font-size:13.5px;line-height:1.6;color:#3D5674}
#mt-cc .t b{display:block;color:#0F2540;font-size:14.5px;margin-bottom:2px}
#mt-cc .a{display:flex;gap:8px;flex:1 1 220px;justify-content:flex-end}
#mt-cc button{flex:1;min-height:44px;padding:0 18px;border-radius:999px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;border:1.5px solid #1466C7}
#mt-cc .n{background:#fff;color:#1466C7}
#mt-cc .y{background:#1466C7;color:#fff}
@media print{#mt-cc{display:none!important}}
</style>
<div class="b"><div class="t"><b data-th="เว็บไซต์นี้ใช้คุกกี้" data-en="This website uses cookies"></b><span data-th="เราใช้คุกกี้ของ Google Analytics เพื่อวิเคราะห์สถิติการเข้าชมและวัดผลการจองออนไลน์ โดยไม่ส่งชื่อ เบอร์โทร หรือรายการตรวจของคุณ คุณเลือกได้ว่าจะยอมรับหรือไม่ และเปลี่ยนได้ทุกเมื่อที่ลิงก์ &quot;ตั้งค่าคุกกี้&quot; ท้ายหน้า" data-en="We use Google Analytics cookies to measure visits and online bookings. Your name, phone number and tests are never sent. You can accept or decline, and change your choice any time from &quot;Cookie settings&quot; at the bottom of the page."></span></div>
<div class="a"><button type="button" class="n" data-v="denied" data-th="ไม่ยอมรับ" data-en="Decline"></button><button type="button" class="y" data-v="granted" data-th="ยอมรับ" data-en="Accept"></button></div></div>
</div>
<script>(function(){var K="mt_cookie_consent",el=document.getElementById("mt-cc");if(!el)return;
var l=null;try{l=localStorage.getItem("mt_lang")}catch(e){}l=l||new URLSearchParams(location.search).get("lang");l=l==="en"?"en":"th";
el.querySelectorAll("[data-th]").forEach(function(n){n.innerHTML=n.getAttribute("data-"+l)});
var get=function(){try{return localStorage.getItem(K)}catch(e){return null}};
var show=function(f){el.hidden=false;if(f){var y=el.querySelector(".y");y&&y.focus({preventScroll:true})}};
el.addEventListener("click",function(e){var v=e.target&&e.target.getAttribute&&e.target.getAttribute("data-v");if(!v)return;
try{localStorage.setItem(K,v)}catch(x){}var g=v==="granted"?"granted":"denied";
if(window.gtag)gtag("consent","update",{ad_storage:g,ad_user_data:g,ad_personalization:g,analytics_storage:g});el.hidden=true});
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href="#cookie-settings"]');if(a){e.preventDefault();show(true)}});
if(!get())show()})();</script>`;
