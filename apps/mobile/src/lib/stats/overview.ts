import { alertLevel, type AlertLevel } from "./alert";
import { monthTotals, type MyShare, type StatTxn } from "./monthTotals";
import { topCategories, type CategoryTotal } from "./topCategories";

export type OverviewTxn = StatTxn & { categoryId?: string | null };

export type Overview = {
  expenseTotal: number;
  incomeTotal: number;
  lastExpenseTotal: number;
  /** Part of `expenseTotal` that comes from my share of group expenses. */
  myShareTotal: number;
  alert: AlertLevel;
  /** Integer percent difference vs last month (absolute value, rounded); 0 when last month is 0. */
  percent: number;
  top: CategoryTotal[];
};

/** "YYYY-MM" of the month before `month`. */
export function prevMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Integer percent change |this - last| / last, rounded half up. 0 when last is 0. */
export function changePercent(thisMonth: number, lastMonth: number): number {
  if (lastMonth <= 0) return 0;
  return Math.floor((200 * Math.abs(thisMonth - lastMonth) + lastMonth) / (2 * lastMonth));
}

export function buildOverview(input: {
  txns: OverviewTxn[];
  lastTxns: OverviewTxn[];
  myShares: MyShare[];
  lastMyShares: MyShare[];
  /** category id -> display name */
  categoryNames: Record<string, string>;
  month: string;
}): Overview {
  const { txns, lastTxns, myShares, lastMyShares, categoryNames, month } = input;
  const cur = monthTotals(txns, myShares, month);
  const last = monthTotals(lastTxns, lastMyShares, prevMonthKey(month));
  const myShareTotal = monthTotals([], myShares, month).expenseTotal;
  const top = topCategories(
    txns
      .filter((t) => !t.groupId)
      .map((t) => ({
        type: t.type,
        amount: t.amount,
        category: t.categoryId ? (categoryNames[t.categoryId] ?? null) : null,
      })),
    4,
  );
  return {
    expenseTotal: cur.expenseTotal,
    incomeTotal: cur.incomeTotal,
    lastExpenseTotal: last.expenseTotal,
    myShareTotal,
    alert: alertLevel(cur.expenseTotal, last.expenseTotal),
    percent: changePercent(cur.expenseTotal, last.expenseTotal),
    top,
  };
}
