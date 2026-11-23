import { shiftMonthKey } from "./monthKey";
import { monthTotals, type MyShare, type StatTxn } from "./monthTotals";

export type TrendPoint = { month: string; total: number };

/** Monthly expense totals for the `count` months ending at `endMonth`, oldest first. Empty months are 0. */
export function monthlyTrend(input: {
  txns: StatTxn[];
  myShares: MyShare[];
  endMonth: string;
  count?: number;
}): TrendPoint[] {
  const { txns, myShares, endMonth, count = 6 } = input;
  const out: TrendPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = shiftMonthKey(endMonth, -i);
    out.push({ month, total: monthTotals(txns, myShares, month).expenseTotal });
  }
  return out;
}
