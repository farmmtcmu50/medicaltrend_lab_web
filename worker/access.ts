// Verifies the Cloudflare Access JWT on admin requests.
// Cloudflare Access (Zero Trust) is the login wall in front of /admin and /api/admin/*;
// this check runs again inside the Worker so a misconfigured Access policy can never
// expose booking data. It fails closed: no configuration means no access.

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;  // e.g. "medicaltrend.cloudflareaccess.com"
  ACCESS_AUD?: string;          // Application Audience (AUD) tag of the Access application
  ADMIN_EMAILS?: string;        // comma-separated allowlist, e.g. "lab@medicaltrend.co.th"
  ADMIN_DEV_EMAIL?: string;     // local `wrangler dev` only: put it in .dev.vars (gitignored). Never set it on the deployed Worker.
}

export type AdminAuth = { ok: true; email: string } | { ok: false; status: number; reason: string };

interface Jwk extends JsonWebKey { kid: string }
let certCache: { at: number; keys: Jwk[] } | null = null;

export async function authenticateAdmin(req: Request, env: AccessEnv): Promise<AdminAuth> {
  const allow = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  if (env.ADMIN_DEV_EMAIL) {
    console.warn('ADMIN_DEV_EMAIL is set: Access check bypassed (local development only)');
    return { ok: true, email: env.ADMIN_DEV_EMAIL };
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !allow.length) {
    return { ok: false, status: 503, reason: 'access_not_configured' };
  }
  // The AUD tag is 64 hex chars; a UUID here is the Application ID pasted by mistake.
  if (!/^[0-9a-f]{64}$/i.test(env.ACCESS_AUD.trim())) {
    return { ok: false, status: 503, reason: 'access_aud_invalid' };
  }

  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, status: 401, reason: 'no_access_token' };

  try {
    const payload = await verifyJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    const email = String(payload.email || '').toLowerCase();
    if (!email || !allow.includes(email)) return { ok: false, status: 403, reason: 'email_not_allowed' };
    return { ok: true, email };
  } catch (err) {
    console.warn('access jwt rejected', err);
    return { ok: false, status: 401, reason: 'invalid_access_token' };
  }
}

async function verifyJwt(token: string, teamDomain: string, aud: string): Promise<Record<string, unknown>> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed');
  const header = JSON.parse(b64urlText(h));
  const payload = JSON.parse(b64urlText(p));
  if (header.alg !== 'RS256') throw new Error('alg');

  const issuer = 'https://' + teamDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== issuer) throw new Error('iss');
  const auds: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('aud');
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) throw new Error('exp');
  if (typeof payload.nbf === 'number' && payload.nbf > now + 30) throw new Error('nbf');

  let keys = await certs(issuer, false);
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { keys = await certs(issuer, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new Error('kid');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('signature');
  return payload;
}

async function certs(issuer: string, force: boolean): Promise<Jwk[]> {
  if (!force && certCache && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetch(issuer + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('certs ' + res.status);
  const body = await res.json<{ keys: Jwk[] }>();
  certCache = { at: Date.now(), keys: body.keys || [] };
  return certCache.keys;
}

function b64urlBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
const b64urlText = (s: string) => new TextDecoder().decode(b64urlBytes(s));
