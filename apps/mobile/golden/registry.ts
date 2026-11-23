import { parseAmount } from "../src/lib/money";
import { alertLevel, monthTotals, type MyShare, type StatTxn } from "../src/lib/stats";
import { buildTransferMessage, generateVietQr } from "../src/lib/vietqr";

export type GoldenFn = (input: Record<string, unknown>) => unknown;

/**
 * Adapters from fixture input to the pure functions in src/lib/**.
 * `undefined` = not implemented yet; the runner lists those cases as todo.
 * Later tickets plug their function in here.
 */
export const registry: Record<string, GoldenFn | undefined> = {
  "money-parse": ({ text }) => {
    const r = parseAmount(String(text));
    return { amount: r.ok ? r.vnd : null };
  },
  split: undefined,
  settlement: undefined,
  stats: (i) => {
    if (i.kind === "alert") {
      return { alert: alertLevel(i.this_month as number, i.last_month as number) !== "none" };
    }
    if (i.kind === "monthly_total") {
      type P = { type: "expense" | "income"; amount: number; occurred_at: string };
      type G = { my_share: number; occurred_at: string };
      const txns: StatTxn[] = (i.personal as P[]).map((p) => ({
        type: p.type,
        amount: p.amount,
        occurredAt: p.occurred_at,
      }));
      const shares: MyShare[] = ((i.group_expenses as G[]) ?? []).map((g) => ({
        amount: g.my_share,
        occurredAt: g.occurred_at,
      }));
      const r = monthTotals(txns, shares, String(i.month));
      return { expense_total: r.expenseTotal, income_total: r.incomeTotal };
    }
    throw new Error(`Unknown stats kind: ${String(i.kind)}`);
  },
  "vietqr-generate": (i) => {
    const message = buildTransferMessage(i.group_name as string | undefined, i.member_name as string | undefined);
    return {
      message,
      payload: generateVietQr({
        bankBin: String(i.bank_bin),
        account: String(i.account_no),
        amount: i.amount as number | undefined,
        message: message ?? undefined,
      }),
    };
  },
  "vietqr-parse": undefined,
};

export const DOMAINS = Object.keys(registry);
