import type { AdminBooking, AdminRow, AdminSummary, Status } from '../../shared/admin';
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
  get: (ref: string) => call<AdminBooking>('/bookings/' + ref),
  setStatus: (ref: string, status: Status) => post<AdminBooking>('/bookings/' + ref + '/status', { status }),
  setNote: (ref: string, note: string) => post<AdminBooking>('/bookings/' + ref + '/note', { note }),
  editItems: (ref: string, persons: EditItem[][], expectedUpdatedAt: string | null) =>
    post<AdminBooking>('/bookings/' + ref + '/items', { persons, expectedUpdatedAt }),
  catalog: async (): Promise<Catalog> => {
    const res = await fetch('/api/catalog');
    if (!res.ok) throw new ApiError(res.status, 'catalog');
    return res.json();
  },
  labOrderUrl: (ref: string) => '/api/admin/bookings/' + ref + '/lab-order',
};
