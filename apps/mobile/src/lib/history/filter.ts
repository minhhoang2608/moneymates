import type { TransactionFilter } from "@/db/repositories";

import { monthKeyOf } from "@/lib/stats/monthKey";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type HistoryFilters = {
  /** "YYYY-MM" (Vietnam local) or null for all months. */
  month: string | null;
  categoryId: string | null;
  moneySource: string | null;
  type: "expense" | "income" | null;
  search: string;
};

export const emptyFilters: HistoryFilters = {
  month: null,
  categoryId: null,
  moneySource: null,
  type: null,
  search: "",
};

export function defaultFilters(now: Date = new Date()): HistoryFilters {
  return { ...emptyFilters, month: monthKeyOf(now.toISOString()) };
}

function monthStartUtc(year: number, month1: number): string {
  return new Date(Date.UTC(year, month1 - 1, 1) - VN_OFFSET_MS).toISOString();
}

/** UTC instants of the local month start and the next month's start. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return { from: monthStartUtc(y, m), to: m === 12 ? monthStartUtc(y + 1, 1) : monthStartUtc(y, m + 1) };
}

export function toTransactionFilter(f: HistoryFilters): TransactionFilter {
  const out: TransactionFilter = {};
  if (f.month) Object.assign(out, monthBounds(f.month));
  if (f.categoryId) out.categoryId = f.categoryId;
  if (f.moneySource) out.moneySource = f.moneySource;
  if (f.type) out.type = f.type;
  if (f.search.trim()) out.search = f.search;
  return out;
}

/** True when a filter or search is active (the month counts: the default month is a filter). */
export function isFiltered(f: HistoryFilters): boolean {
  return (
    f.month !== null || f.categoryId !== null || f.moneySource !== null || f.type !== null || f.search.trim() !== ""
  );
}

/** Last `count` month keys, newest first, starting at `now`'s month. */
export function recentMonths(now: Date, count = 12): string[] {
  const [y, m] = monthKeyOf(now.toISOString()).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

export function monthNumber(month: string): number {
  return Number(month.split("-")[1]);
}
