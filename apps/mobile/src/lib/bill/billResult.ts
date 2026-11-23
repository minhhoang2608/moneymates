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
): Record<string, string> {
  const p: Record<string, string> = { source: "bill" };
  if (r?.amount) p.amount = String(r.amount);
  if (r?.shop) p.note = r.shop;
  if (categoryId) p.categoryId = categoryId;
  if (imageUri) p.attachmentUri = imageUri;
  return p;
}
