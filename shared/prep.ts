// Patient preparation advice for the printed appointment slip, from the tests booked.
// Matching is by keywords in test / package names and descriptions; staff can still edit the text before printing.

export interface PrepInput {
  /** Name plus any description of every item booked for this person. */
  items: { kind: 'package' | 'test'; text: string }[];
  mode: 'lab' | 'home';
  hasLabOrder: boolean;
}

const has = (texts: string[], re: RegExp) => texts.some(t => re.test(t));

const FASTING = /glucose(?!.*fluid)|\bfbs\b|fasting|blood sugar|\blipid|cholesterol|triglyceride|\bhdl\b|\bldl\b|insulin|homa|น้ำตาล|ไขมัน|เบาหวาน/i;
// Health-check packages include blood sugar and lipids; STD, allergy and PCR packages do not.
const NON_FASTING_PACKAGE = /std|hiv|syphilis|เพศ|allerg|แพ้|pcr|hpv|hepatitis|ไวรัสตับ/i;
const THYROID = /\btsh\b|\bft3\b|\bft4\b|\bt3\b|\bt4\b|thyroid|ไทรอยด์|troponin/i;
const CORTISOL = /cortisol/i;
const PSA = /\bpsa\b/i;
const URINE = /urine|urinalysis|\bua\b|ปัสสาวะ/i;
const STOOL = /stool|occult|\bfobt\b|\bfit\b|อุจจาระ/i;
const URIC = /uric/i;

/** Advice lines in Thai, most important first. */
export function prepAdvice(p: PrepInput): string[] {
  const texts = p.items.map(i => i.text);
  const fasting = has(texts, FASTING) || p.items.some(i => i.kind === 'package' && !NON_FASTING_PACKAGE.test(i.text));
  const out: string[] = [];

  if (fasting) {
    out.push('งดอาหารและเครื่องดื่มทุกชนิด อย่างน้อย 10 ชั่วโมงก่อนเจาะเลือด (ดื่มน้ำเปล่าได้ตามปกติ)');
    out.push('งดเครื่องดื่มแอลกอฮอล์อย่างน้อย 24 ชั่วโมงก่อนตรวจ');
    out.push('ผู้ป่วยเบาหวานที่ใช้ยาลดน้ำตาลหรืออินซูลิน ควรปรึกษาแพทย์เรื่องการใช้ยาในช่วงงดอาหาร');
  }
  if (has(texts, URIC)) out.push('งดอาหารที่มีพิวรีนสูง เช่น เครื่องในสัตว์ ยอดผัก และแอลกอฮอล์ 24 ชั่วโมงก่อนตรวจ');
  if (has(texts, CORTISOL)) out.push('ควรเจาะเลือดช่วงเช้า เวลา 07:00–09:00 น. และพักผ่อนให้เพียงพอก่อนตรวจ');
  if (has(texts, THYROID)) out.push('หากรับประทานวิตามินหรืออาหารเสริมที่มีไบโอติน (Biotin) ควรงดอย่างน้อย 48 ชั่วโมงก่อนตรวจ เนื่องจากอาจรบกวนผลตรวจ');
  if (has(texts, PSA)) out.push('งดการหลั่งน้ำอสุจิและการออกกำลังกายหนัก เช่น ปั่นจักรยาน อย่างน้อย 48 ชั่วโมงก่อนตรวจ');
  if (has(texts, URINE)) {
    out.push('เก็บปัสสาวะช่วงกลาง (Midstream) ครั้งแรกตอนเช้าของวันตรวจ ใส่ภาชนะที่ได้รับจากเจ้าหน้าที่');
    out.push('สตรีควรหลีกเลี่ยงการเก็บปัสสาวะในช่วงมีประจำเดือน');
  }
  if (has(texts, STOOL)) out.push('เก็บอุจจาระประมาณเท่าปลายนิ้วโป้ง ใส่ภาชนะที่ได้รับจากเจ้าหน้าที่ ไม่ให้ปนเปื้อนปัสสาวะหรือน้ำ และนำส่งภายใน 2 ชั่วโมง');
  if (p.hasLabOrder) out.push('นำใบสั่งตรวจจากแพทย์ฉบับจริงมาด้วย และปฏิบัติตามคำแนะนำการเตรียมตัวของแพทย์ผู้สั่งตรวจ');
  if (!fasting && p.items.length && !p.hasLabOrder) out.push('รายการตรวจนี้ไม่จำเป็นต้องงดอาหาร รับประทานอาหารและดื่มน้ำได้ตามปกติ');

  out.push('รับประทานยาประจำตัวได้ตามปกติ เว้นแต่แพทย์แนะนำเป็นอย่างอื่น และแจ้งเจ้าหน้าที่หากใช้ยาละลายลิ่มเลือด หรือเคยเป็นลมขณะเจาะเลือด');
  out.push('สวมเสื้อแขนสั้นหรือเสื้อที่พับแขนขึ้นได้สะดวก');
  out.push(p.mode === 'home'
    ? 'ทีมเจาะเลือดจะโทรแจ้งก่อนเดินทางถึง กรุณาเตรียมบัตรประชาชน และที่นั่งพร้อมโต๊ะสำหรับวางแขน'
    : 'นำบัตรประชาชนและใบนัดนี้มาด้วย และมาถึงก่อนเวลานัดประมาณ 10–15 นาที');
  return out;
}

/**
 * Can the customer print the appointment slip? Branch visits: as soon as they are booked.
 * Home collection: only once staff have confirmed the visit. Never for cancelled bookings.
 */
export const slipPrintable = (mode: string, status: string) => status !== 'cancelled' && (mode === 'lab' || status !== 'pending');
