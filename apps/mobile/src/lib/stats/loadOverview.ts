import type { Repositories } from "@/db/RepositoriesProvider";
import type { TransactionRow } from "@/db/repositories";
import { monthBounds } from "@/lib/history/filter";

import { monthKeyOf } from "./monthKey";
import { emptyMyShareSource, type MyShareSource } from "./myShareSource";
import { buildOverview, prevMonthKey, type Overview, type OverviewTxn } from "./overview";

export const RECENT_COUNT = 5;

export type OverviewData = {
  month: string;
  overview: Overview;
  recent: TransactionRow[];
  categoryNames: Record<string, string>;
  hasAny: boolean;
};

const toStat = (t: TransactionRow): OverviewTxn => ({
  type: t.type,
  amount: t.amount,
  occurredAt: t.occurred_at,
  groupId: t.group_id,
  categoryId: t.category_id,
});

/** Read-only, offline: queries SQLite for this and last month and feeds the pure stats functions. */
export async function loadOverview(
  repos: Pick<Repositories, "transactions" | "categories">,
  opts: { now?: Date; myShares?: MyShareSource } = {},
): Promise<OverviewData> {
  const month = monthKeyOf((opts.now ?? new Date()).toISOString());
  const last = prevMonthKey(month);
  const myShares = opts.myShares ?? emptyMyShareSource;
  const [rows, lastRows, all, exp, inc, shares, lastShares] = await Promise.all([
    repos.transactions.list({ ...monthBounds(month), personalOnly: true }),
    repos.transactions.list({ ...monthBounds(last), personalOnly: true }),
    repos.transactions.list(),
    repos.categories.listByKind("expense"),
    repos.categories.listByKind("income"),
    myShares(month),
    myShares(last),
  ]);
  const categoryNames = Object.fromEntries([...exp, ...inc].map((c) => [c.id, c.name]));
  return {
    month,
    overview: buildOverview({
      txns: rows.map(toStat),
      lastTxns: lastRows.map(toStat),
      myShares: shares,
      lastMyShares: lastShares,
      categoryNames,
      month,
    }),
    recent: all.slice(0, RECENT_COUNT),
    categoryNames,
    hasAny: all.length > 0,
  };
}
