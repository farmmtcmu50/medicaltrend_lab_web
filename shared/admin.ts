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

export const PATIENT_LABELS: Record<string, string> = { general: 'ทั่วไป', elderly: 'ผู้สูงอายุ', bedridden: 'ติดเตียง' };

export interface AdminRow {
  ref: string; created_at: string; status: Status; mode: 'lab' | 'home'; branch: BranchId | null;
  visit_date: string; slot: string; people: number; contact_name: string; contact_phone: string; total: number;
}

export interface AdminBooking extends AdminRow {
  address: string | null; latitude: number | null; longitude: number | null; patient_type: string | null;
  distance_km: number | null; contact_line: string | null; contact_email: string | null; note: string | null;
  lab_order_name: string | null; has_lab_order: boolean; items_subtotal: number; travel_fee: number;
  price_source: string; pdpa_consent_at: string; lang: string; staff_note: string | null; updated_at: string | null;
  map_url: string | null;
  items: { person_no: number; kind: 'package' | 'test'; name: string; price: number }[];
  events: { at: string; actor: string; action: 'created' | 'status' | 'note'; from_status: string | null; to_status: string | null; note: string | null }[];
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
}
