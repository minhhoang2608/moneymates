import type { ParseBillResponse } from "@/api/parseBill";
import type { ApiErrorCode } from "@/api/errors";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";

export const NO_VALUE = "—";

export type BillCard = { amount: string; shop: string; date: string; category: string };

/** "2026-11-22" -> "22/11/2026"; anything else -> "—". */
export function formatBillDate(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : NO_VALUE;
}

export function toBillCard(r: ParseBillResponse): BillCard {
  return {
    amount: r.amount === null ? NO_VALUE : formatVnd(r.amount),
    shop: r.shop ?? NO_VALUE,
    date: formatBillDate(r.date),
    category: r.category ?? NO_VALUE,
  };
}

export function billErrorMessage(code: ApiErrorCode): string {
  return vi.apiErrors[code];
}

/** Query params for `/transaction/new`. `categoryId` is the matching category, or "Khác" when unknown. */
export function toFormParams(
  r: ParseBillResponse | null,
  imageUri: string | null,
  categoryId: string | null,
  groupId?: string | null,
): Record<string, string> {
  const p: Record<string, string> = { source: "bill" };
  if (groupId) p.groupId = groupId;
  if (r?.amount) p.amount = String(r.amount);
  if (r?.shop) p.note = r.shop;
  if (categoryId) p.categoryId = categoryId;
  if (r?.date && /^\d{4}-\d{2}-\d{2}/.test(r.date) && !Number.isNaN(Date.parse(r.date.slice(0, 10)))) {
    p.date = r.date.slice(0, 10);
  }
  if (imageUri) p.attachmentUri = imageUri;
  return p;
}

/** Local calendar day of the bill with the current time of day; invalid or missing -> `now`. */
export function billDateToLocal(iso: string | null | undefined, now: Date): Date {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return now;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const out = new Date(y, mo, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return out.getFullYear() === y && out.getMonth() === mo && out.getDate() === d ? out : now;
}
