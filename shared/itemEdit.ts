// Editing a booking's tests from the Booking Console. Shared by the admin page (live preview)
// and the Worker (authoritative re-price), so the total staff see before saving is the total stored.
import { POPULAR, popularKey, type Catalog } from './catalog';
import { STD_PACKAGES } from './std';

export type ItemKind = 'package' | 'test';
export interface BookItem { kind: ItemKind; name: string; price: number; group: string; code?: string; detail?: string }
export interface EditItem { kind: ItemKind; name: string }
export interface StoredItem { person_no: number; kind: ItemKind; name: string; price: number }

export const MAX_PERSONS = 8;
export const MAX_ITEMS_PER_PERSON = 60;

/** Everything staff can add: sheet packages (PAC-xx), popular items, STD page packages and single tests. */
export function priceBook(cat: Catalog): BookItem[] {
  const out: BookItem[] = [];
  const seen = new Set<string>();
  const add = (x: BookItem) => {
    const k = x.kind + '|' + x.name;
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  };
  for (const p of cat.packages) add({ kind: 'package', name: p.name, price: p.price, group: 'แพ็กเกจ', code: p.id, detail: p.detail });
  for (const p of POPULAR) {
    if (p.tiers) for (const t of p.tiers) add({ kind: 'package', name: popularKey(p, t), price: t.price, group: 'ยอดนิยม' });
    else if (p.price) add({ kind: 'package', name: p.name, price: p.price, group: 'ยอดนิยม', detail: p.detail });
  }
  for (const p of STD_PACKAGES) add({ kind: 'package', name: 'STD ' + p.name, price: p.price, group: 'หน้า STD' });
  for (const t of cat.tests) add({ kind: 'test', name: t.n, price: t.p, group: t.c, code: t.id, detail: t.th });
  return out;
}

export interface PricedEdit {
  persons: { items: StoredItem[]; subtotal: number }[];
  subtotal: number;
  unknown: string[];
  added: StoredItem[];
  removed: StoredItem[];
}

/**
 * Prices an edited item list. Items the booking already had keep the price the customer was quoted;
 * new items take today's price from the book. Unknown names are reported, not priced.
 */
export function priceEdit(existing: StoredItem[], persons: EditItem[][], book: BookItem[]): PricedEdit {
  const bookPrice = new Map(book.map(b => [b.kind + '|' + b.name, b.price]));
  const oldPrice = new Map(existing.map(i => [i.kind + '|' + i.name, i.price]));
  const unknown: string[] = [];
  const priced = persons.map((items, i) => {
    const out: StoredItem[] = [];
    for (const it of items) {
      const k = it.kind + '|' + it.name;
      const price = oldPrice.get(k) ?? bookPrice.get(k);
      if (price === undefined) unknown.push(it.name);
      else out.push({ person_no: i + 1, kind: it.kind, name: it.name, price });
    }
    return { items: out, subtotal: out.reduce((a, x) => a + x.price, 0) };
  });
  const flat = priced.flatMap(p => p.items);
  const key = (x: StoredItem) => x.person_no + '|' + x.kind + '|' + x.name;
  const before = new Set(existing.map(key)), after = new Set(flat.map(key));
  return {
    persons: priced,
    subtotal: priced.reduce((a, p) => a + p.subtotal, 0),
    unknown,
    added: flat.filter(x => !before.has(key(x))),
    removed: existing.filter(x => !after.has(key(x))),
  };
}

const baht = (n: number) => '฿' + n.toLocaleString('en-US');

/** One-line summary for the booking history, e.g. "+ คนที่ 1 HbA1c ฿250 · − คนที่ 2 CBC ฿150 · ยอดรวม ฿1,200 → ฿1,300". */
export function describeEdit(e: Pick<PricedEdit, 'added' | 'removed'>, oldTotal: number, newTotal: number): string {
  const parts = [
    ...e.added.map(x => `+ คนที่ ${x.person_no} ${x.name} ${baht(x.price)}`),
    ...e.removed.map(x => `− คนที่ ${x.person_no} ${x.name} ${baht(x.price)}`),
  ];
  if (!parts.length) parts.push('จัดลำดับ/จำนวนผู้รับบริการใหม่');
  return parts.join(' · ') + ` · ยอดรวม ${baht(oldTotal)} → ${baht(newTotal)}`;
}
