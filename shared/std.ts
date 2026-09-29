// STD testing page (/std): packages, custom PCR tiers, branch hours.
// Shared by the page and the Worker so the price shown is the price stored.
// Source: Claude Design "MedicalTrend STD Testing" (Desktop/Mobile boards).
import { BRANCH_IDS, type BranchId } from './catalog';

export const STD_PACKAGES = [
  { key: 'p0', name: 'Basic', price: 880 },
  { key: 'p1', name: 'STI PCR 14', price: 2100 },
  { key: 'p2', name: 'Complete', price: 2690 },
  { key: 'p3', name: 'Complete + HPV', price: 3290 },
  { key: 'p4', name: 'Early Detection', price: 6590 },
] as const;

export type StdKey = 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'custom' | 'unsure';
export const STD_KEY_ORDER: StdKey[] = ['p0', 'p1', 'p2', 'p3', 'p4', 'custom', 'unsure'];

/** Packages that already include other selections (e.g. Complete = Basic + STI PCR 14). */
export const STD_COVERS: Record<StdKey, StdKey[]> = {
  p0: [], p1: ['custom'], p2: ['p0', 'p1', 'custom'], p3: ['p0', 'p1', 'p2', 'custom'],
  p4: ['p0', 'p1', 'p2', 'p3', 'custom'], custom: [], unsure: [],
};

/** The 14 pathogens of the STI PCR panel: [code, scientific name, Thai, English]. */
export const STD_PATHOGENS: [string, string, string, string][] = [
  ['CT', 'Chlamydia trachomatis', 'หนองในเทียม', 'Chlamydia'],
  ['NG', 'Neisseria gonorrhoeae', 'หนองในแท้', 'Gonorrhea'],
  ['Mh', 'Mycoplasma hominis', 'มัยโคพลาสมา', 'Mycoplasma'],
  ['HSV1', 'Herpes simplex virus type 1', 'เริม ชนิดที่ 1', 'Herpes type 1'],
  ['HSV2', 'Herpes simplex virus type 2', 'เริม ชนิดที่ 2', 'Herpes type 2'],
  ['UU', 'Ureaplasma urealyticum', 'ยูเรียพลาสมา', 'Ureaplasma'],
  ['UP', 'Ureaplasma parvum', 'ยูเรียพลาสมา', 'Ureaplasma'],
  ['Mg', 'Mycoplasma genitalium', 'มัยโคพลาสมา', 'Mycoplasma'],
  ['CA', 'Candida albicans', 'เชื้อราแคนดิดา', 'Yeast infection'],
  ['GV', 'Gardnerella vaginalis', 'ภาวะแบคทีเรียในช่องคลอดผิดสมดุล', 'Bacterial vaginosis'],
  ['TV', 'Trichomonas vaginalis', 'พยาธิในช่องคลอด (ทริโคโมแนส)', 'Trichomoniasis'],
  ['GBS', 'Group B streptococci', 'สเตรปโตคอคคัสกลุ่มบี', 'Group B strep'],
  ['HD', 'Haemophilus ducreyi', 'แผลริมอ่อน', 'Chancroid'],
  ['TP', 'Treponema pallidum', 'ซิฟิลิส', 'Syphilis'],
];

export const TIER_CAPS = [3, 7, 11, 14];
export const TIER_PRICES = [1200, 1600, 1800, 2100];
export const tierPrice = (n: number) => n <= 0 ? 0 : n <= 3 ? 1200 : n <= 7 ? 1600 : n <= 11 ? 1800 : 2100;

/** Branch order on the STD page matches BRANCH_IDS. Opening hours [from, to) by weekday (0 = Sunday). */
export function branchHours(branch: BranchId, dow: number): [number, number] | null {
  if (branch === 'sankamphaeng') return dow === 0 || dow === 6 ? [7, 16] : [7, 19];
  if (branch === 'hangdong' || branch === 'watket') return [7, 16];
  if (branch === 'phayao') return dow === 0 ? null : [8, 16];
  return null;
}
export const STD_BRANCHES: readonly BranchId[] = BRANCH_IDS;

export const STD_BOOKING_DAYS = 60;

export interface StdLine { key: StdKey; name: string; price: number }

/**
 * Prices a selection. Throws on anything the page itself would never produce:
 * unknown keys, a package already covered by another, "unsure" mixed with others,
 * or a custom panel without pathogens.
 */
export function priceStd(keys: string[], pathogens: number[]): { lines: StdLine[]; total: number; unsure: boolean } {
  const ks = [...new Set(keys)] as StdKey[];
  if (!ks.length) throw new Error('empty');
  if (ks.some(k => !STD_KEY_ORDER.includes(k))) throw new Error('unknown key');
  if (ks.includes('unsure')) {
    if (ks.length > 1) throw new Error('unsure must be alone');
    return { lines: [{ key: 'unsure', name: 'ยังไม่แน่ใจ ให้เจ้าหน้าที่แนะนำ', price: 0 }], total: 0, unsure: true };
  }
  for (const k of ks) if (ks.some(o => o !== k && STD_COVERS[o].includes(k))) throw new Error('covered: ' + k);
  const picks = [...new Set(pathogens)].sort((a, b) => a - b);
  if (picks.some(i => !Number.isInteger(i) || i < 0 || i >= STD_PATHOGENS.length)) throw new Error('pathogen');
  if (ks.includes('custom') && picks.length === 0) throw new Error('custom needs pathogens');
  if (!ks.includes('custom') && picks.length > 0) throw new Error('pathogens need custom');

  const lines = ks.sort((a, b) => STD_KEY_ORDER.indexOf(a) - STD_KEY_ORDER.indexOf(b)).map((k): StdLine => {
    if (k === 'custom') {
      const codes = picks.map(i => STD_PATHOGENS[i][0]).join(', ');
      return { key: k, name: `PCR เลือกเชื้อเอง · ${picks.length} เชื้อ (${codes})`, price: tierPrice(picks.length) };
    }
    const p = STD_PACKAGES.find(x => x.key === k)!;
    return { key: k, name: 'STD ' + p.name, price: p.price };
  });
  return { lines, total: lines.reduce((a, l) => a + l.price, 0), unsure: false };
}
