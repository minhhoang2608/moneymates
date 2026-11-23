import type { Repositories } from "@/db/RepositoriesProvider";
import type { TransactionRow } from "@/db/repositories";
import { monthBounds } from "@/lib/history/filter";

import { categoryBreakdown, type Breakdown } from "./breakdown";
import { shiftMonthKey } from "./monthKey";
import type { StatTxn } from "./monthTotals";
import { monthlyTrend, type TrendPoint } from "./trend";

type Repos = Pick<Repositories, "transactions" | "categories" | "groupExpenses">;

const toStat = (t: TransactionRow): StatTxn & { categoryId: string | null } => ({
  type: t.type,
  amount: t.amount,
  occurredAt: t.occurred_at,
  groupId: t.group_id,
  categoryId: t.category_id,
});

/** Category totals for a "YYYY-MM" month. Read-only, offline. */
export async function loadCategoryBreakdown(
  repos: Repos,
  month: string,
  kind: "expense" | "income",
): Promise<Breakdown> {
  const [rows, shares, cats] = await Promise.all([
    repos.transactions.list({ ...monthBounds(month), personalOnly: true, type: kind }),
    kind === "expense" ? repos.groupExpenses.mySharesInMonth(month) : Promise.resolve([]),
    repos.categories.listByKind(kind),
  ]);
  return categoryBreakdown({
    txns: rows.map(toStat),
    myShares: shares,
    month,
    kind,
    categoryNames: Object.fromEntries(cats.map((c) => [c.id, c.name])),
  });
}

/** Expense totals for the `count` months ending at `endMonth`, oldest first. */
export async function loadMonthlyTrend(repos: Repos, endMonth: string, count = 6): Promise<TrendPoint[]> {
  const months = Array.from({ length: count }, (_, i) => shiftMonthKey(endMonth, -(count - 1 - i)));
  const from = monthBounds(months[0]).from;
  const to = monthBounds(endMonth).to;
  const [rows, shares] = await Promise.all([
    repos.transactions.list({ from, to, personalOnly: true, type: "expense" }),
    Promise.all(months.map((m) => repos.groupExpenses.mySharesInMonth(m))),
  ]);
  return monthlyTrend({ txns: rows.map(toStat), myShares: shares.flat(), endMonth, count });
}
