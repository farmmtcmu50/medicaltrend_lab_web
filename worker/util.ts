// Small helpers shared by the Worker's route handlers.

export function bangkokToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** MT-YYMMDD-XXXX with an unambiguous alphabet (no 0/O/1/I). */
export function bookingRef(now: Date): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const tail = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  const bkk = new Date(now.getTime() + 7 * 3600_000).toISOString();
  return `MT-${bkk.slice(2, 4)}${bkk.slice(5, 7)}${bkk.slice(8, 10)}-${tail}`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...(status >= 400 || !headers['cache-control'] ? { 'cache-control': 'no-store' } : {}),
      ...headers,
    },
  });
}
