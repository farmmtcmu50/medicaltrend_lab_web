import type { AdminBooking, AdminRow, AdminSummary, PopularRow, Status } from '../../shared/admin';
import type { Catalog } from '../../shared/catalog';
import type { EditItem } from '../../shared/itemEdit';

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api/admin' + path, { credentials: 'same-origin', ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || 'error');
  return body as T;
}

const post = <T>(path: string, data: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export interface ListQuery { status?: string; branch?: string; source?: string; q?: string; from?: string; to?: string; page?: number }

export const api = {
  me: () => call<{ email: string }>('/me'),
  summary: () => call<AdminSummary>('/summary'),
  list: (q: ListQuery) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== 'all') p.set(k, String(v));
    return call<{ rows: AdminRow[]; total: number; page: number; pageSize: number }>('/bookings?' + p);
  },
  calendar: (q: ListQuery, from: string, to: string) => {
    const p = new URLSearchParams({ calendar: '1', from, to });
    for (const k of ['status', 'branch', 'source', 'q'] as const) { const v = q[k]; if (v && v !== 'all') p.set(k, v); }
    return call<{ rows: AdminRow[] }>('/bookings?' + p);
  },
  get: (ref: string) => call<AdminBooking>('/bookings/' + ref),
  setStatus: (ref: string, status: Status) => post<AdminBooking>('/bookings/' + ref + '/status', { status }),
  setLocation: (ref: string, data: { lat: number; lng: number; mapUrl: string | null; address: string; expectedUpdatedAt: string | null }) =>
    post<AdminBooking>('/bookings/' + ref + '/location', data),
  setBranch: (ref: string, branch: string) => post<AdminBooking>('/bookings/' + ref + '/branch', { branch }),
  setNote: (ref: string, note: string) => post<AdminBooking>('/bookings/' + ref + '/note', { note }),
  editItems: (ref: string, persons: EditItem[][], expectedUpdatedAt: string | null) =>
    post<AdminBooking>('/bookings/' + ref + '/items', { persons, expectedUpdatedAt }),
  catalog: async (): Promise<Catalog> => {
    const res = await fetch('/api/catalog');
    if (!res.ok) throw new ApiError(res.status, 'catalog');
    return res.json();
  },
  popular: () => call<{ items: PopularRow[] }>('/popular'),
  savePopular: (data: Record<string, unknown>, poster: Blob | null) => {
    const form = new FormData();
    form.set('data', JSON.stringify(data));
    if (poster) form.set('poster', poster, 'poster.webp');
    return call<{ items: PopularRow[] }>('/popular', { method: 'POST', body: form });
  },
  popularOrder: (ids: string[]) => post<{ items: PopularRow[] }>('/popular/order', { ids }),
  popularActive: (id: string, active: boolean) => post<{ items: PopularRow[] }>('/popular/' + id + '/active', { active }),
  popularDelete: (id: string) => post<{ items: PopularRow[] }>('/popular/' + id + '/delete', {}),
  labOrderUrl: (ref: string) => '/api/admin/bookings/' + ref + '/lab-order',
};
