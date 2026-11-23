import { monthKeyOf } from "./monthKey";

export type StatTxn = {
  type: "expense" | "income";
  amount: number;
  occurredAt: string;
  groupId?: string | null;
};

export type MyShare = { amount: number; occurredAt: string };

export type MonthTotals = { expenseTotal: number; incomeTotal: number };

function check(amount: number): number {
  if (!Number.isSafeInteger(amount)) throw new Error(`Amount must be an integer VND: ${amount}`);
  return amount;
}

/**
 * Month totals (integer VND). Expense = personal expenses + my share of group expenses.
 * Income = personal incomes. Group rows in `txns` and settlements are never counted.
 */
export function monthTotals(txns: StatTxn[], myShares: MyShare[], month: string): MonthTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  for (const t of txns) {
    if (t.groupId) continue;
    if (monthKeyOf(t.occurredAt) !== month) continue;
    if (t.type === "expense") expenseTotal += check(t.amount);
    else incomeTotal += check(t.amount);
  }
  for (const s of myShares) {
    if (monthKeyOf(s.occurredAt) === month) expenseTotal += check(s.amount);
  }
  return { expenseTotal, incomeTotal };
}
