import { monthKeyOf } from "./monthKey";
import type { MyShare, StatTxn } from "./monthTotals";

export type BreakdownItem = { categoryId: string | null; category: string; amount: number };

export type Breakdown = {
  total: number;
  /** Part of `total` that comes from my share of group expenses (always 0 for income). */
  groupShareTotal: number;
  items: BreakdownItem[];
};

const OTHER = "Khác";

function check(amount: number): number {
  if (!Number.isSafeInteger(amount)) throw new Error(`Amount must be an integer VND: ${amount}`);
  return amount;
}

/**
 * Per-category totals for a VN local month (integer VND). Same rules as `monthTotals`:
 * personal rows plus my share of group expenses (expense only); group rows and settlements are skipped.
 * A null or unknown category id is shown as "Khác".
 */
export function categoryBreakdown(input: {
  txns: (StatTxn & { categoryId?: string | null })[];
  myShares: MyShare[];
  month: string;
  kind: "expense" | "income";
  /** category id -> display name */
  categoryNames: Record<string, string>;
}): Breakdown {
  const { txns, myShares, month, kind, categoryNames } = input;
  const sums = new Map<string | null, number>();
  const add = (id: string | null | undefined, amount: number) => {
    const key = id && categoryNames[id] ? id : null;
    sums.set(key, (sums.get(key) ?? 0) + amount);
  };
  let total = 0;
  let groupShareTotal = 0;
  for (const t of txns) {
    if (t.groupId || t.type !== kind || monthKeyOf(t.occurredAt) !== month) continue;
    const a = check(t.amount);
    total += a;
    add(t.categoryId, a);
  }
  if (kind === "expense") {
    for (const s of myShares) {
      if (monthKeyOf(s.occurredAt) !== month) continue;
      const a = check(s.amount);
      total += a;
      groupShareTotal += a;
      add(s.categoryId, a);
    }
  }
  // Merge ids that share a display name with "Khác" so the label appears once.
  const byName = new Map<string, BreakdownItem>();
  for (const [id, amount] of sums) {
    const category = id ? categoryNames[id] : OTHER;
    const prev = byName.get(category);
    if (prev) prev.amount += amount;
    else byName.set(category, { categoryId: id, category, amount });
  }
  const items = [...byName.values()].sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, "vi"));
  return { total, groupShareTotal, items };
}
