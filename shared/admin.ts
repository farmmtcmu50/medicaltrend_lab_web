// Booking statuses and branch names shared by the admin API and the admin page.
// Labels and colours follow the Admin Console design (project/Admin Console.dc.html).
import type { BranchId } from './catalog';

export const STATUS_FLOW = ['pending', 'confirmed', 'assigned', 'enroute', 'collected', 'lab', 'result', 'done'] as const;
export const STATUSES = [...STATUS_FLOW, 'cancelled'] as const;
export type Status = typeof STATUSES[number];

export const STATUS_META: Record<Status, { label: string; c: string; bg: string }> = {
  pending: { label: 'รอยืนยัน', c: '#A26A00', bg: '#FFF4E0' },
  confirmed: { label: 'ยืนยันแล้ว', c: '#0B4F9E', bg: '#EAF3FF' },
  assigned: { label: 'จ่ายงานแล้ว', c: '#1466C7', bg: '#E9F2FE' },
  enroute: { label: 'กำลังเดินทาง', c: '#5B45C9', bg: '#F0EDFF' },
  collected: { label: 'เจาะแล้ว', c: '#0F7A6B', bg: '#E4F6F2' },
  lab: { label: 'ส่งแล็บแล้ว', c: '#0F7A6B', bg: '#E4F6F2' },
  result: { label: 'ผลออกแล้ว', c: '#0B6E60', bg: '#DFF5F0' },
  done: { label: 'ปิดงาน', c: '#5A7189', bg: '#F0F4F9' },
  cancelled: { label: 'ยกเลิก', c: '#A3242A', bg: '#FDECEC' },
};

export const BRANCH_NAMES: Record<BranchId, string> = {
  sankamphaeng: 'ศูนย์แล็บ เมดิคอลเทรนด์ — สันกำแพง',
  hangdong: 'ราชพฤกษ์แล็บ — หางดง',
  watket: 'เมดิคอลเทรนด์แล็บ ไอบลิส — วัดเกตุ',
  phayao: 'เมดิคอลเทรนด์ เฮลธ์แคร์ สหคลินิก — พะเยา',
};

/** Area part of a branch name, e.g. 'หางดง'. */
export const branchArea = (id: string | null | undefined) =>
  id ? (BRANCH_NAMES[id as BranchId] || id).split('—').pop()!.trim() : '';

/** Short where-label for lists: 'สันกำแพง', 'ถึงบ้าน · หางดง', or 'ถึงบ้าน · ยังไม่ระบุสาขา'. */
export const whereShort = (mode: string, branch: string | null) =>
  mode === 'home' ? 'ถึงบ้าน · ' + (branchArea(branch) || 'ยังไม่ระบุสาขา') : branchArea(branch) || '—';

export const PATIENT_LABELS: Record<string, string> = { general: 'ทั่วไป', elderly: 'ผู้สูงอายุ', bedridden: 'ติดเตียง' };

export interface AdminRow {
  ref: string; created_at: string; status: Status; mode: 'lab' | 'home'; branch: BranchId | null;
  visit_date: string; slot: string; people: number; contact_name: string; contact_phone: string; total: number;
  source: 'web' | 'std';
  /** Booked with a doctor's lab order and no tests yet: staff must price it (list rows only). */
  rx_pending?: number;
}

export interface AdminBooking extends AdminRow {
  address: string | null; latitude: number | null; longitude: number | null; patient_type: string | null;
  distance_km: number | null; contact_line: string | null; contact_email: string | null; note: string | null;
  lab_order_name: string | null; has_lab_order: boolean; items_subtotal: number; travel_fee: number;
  price_source: string; pdpa_consent_at: string; lang: string; staff_note: string | null; updated_at: string | null;
  map_url: string | null;
  referrer: string | null;
  items: { person_no: number; kind: 'package' | 'test'; name: string; price: number }[];
  emails: { at: string; kind: string; to_addr: string; status: 'sent' | 'failed'; error: string | null }[];
  events: { at: string; actor: string; action: 'created' | 'status' | 'note' | 'items' | 'branch' | 'location'; from_status: string | null; to_status: string | null; note: string | null }[];
}

export interface AdminSummary {
  today: string;
  visitsToday: number;
  homeVisitsToday: number;
  newToday: number;
  pending: number;
  monthRevenue: number;
  monthBookings: number;
  statusToday: Record<string, number>;
  revenueByBranch: { key: string; amount: number; count: number }[];
  topItems: { name: string; count: number; amount: number }[];
  referrers: { source: string; referrer: string | null; count: number; amount: number }[];
}

/** A row of popular_items (STEP 2 cards managed in the Booking Console). */
export interface PopularRow {
  id: string; sort: number; active: number; name: string; name_en: string; detail: string; detail_en: string;
  price: number | null; was: number | null; tiers_json: string | null; code: string | null; poster: string;
  std_link: number; updated_at: string; updated_by: string;
}
