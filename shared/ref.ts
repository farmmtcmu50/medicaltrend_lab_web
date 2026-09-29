// Where a booking came from, e.g. "main-nav", "main-search", "line-oa", "ext:facebook.com", "direct".
// Links on our own pages add ?ref=…; ads and QR codes can use ?ref=… or ?utm_source=….

export const cleanRef = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().slice(0, 60);
  return /^[a-z0-9][a-z0-9._:-]*$/.test(s) ? s : null;
};

const LABELS: Record<string, string> = {
  'main-nav': 'เมนูหัวเว็บหน้าหลัก',
  'main-popular': 'การ์ด STD ในรายการยอดนิยม',
  'main-popular-more': 'ลิงก์ใต้รายการยอดนิยม',
  'main-search': 'ช่องค้นหารายการตรวจ',
  'main-footer': 'ท้ายเว็บหน้าหลัก',
  'std-home-addon': 'การ์ดเจาะเลือดนอกสถานที่ (หน้า STD)',
  direct: 'เข้าตรง / พิมพ์ลิงก์เอง',
};
export const refLabel = (r: string | null | undefined) =>
  !r ? 'ไม่ทราบ (ก่อนเริ่มบันทึก)' : LABELS[r] || (r.startsWith('ext:') ? 'จากเว็บ ' + r.slice(4) : r);
