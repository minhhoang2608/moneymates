import type { StatTxn } from "./monthTotals";

export type CategoryTotal = { category: string; amount: number };

export function topCategories(
  txns: (Pick<StatTxn, "type" | "amount"> & { category?: string | null })[],
  n: number,
): CategoryTotal[] {
  const sums = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    if (!Number.isSafeInteger(t.amount)) throw new Error(`Amount must be an integer VND: ${t.amount}`);
    const key = t.category || "Khác";
    sums.set(key, (sums.get(key) ?? 0) + t.amount);
  }
  return [...sums.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, "vi"))
    .slice(0, Math.max(0, n));
}
