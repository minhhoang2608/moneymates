import { parseAmount } from "../src/lib/money";
import { splitByAmount, splitByPercent, splitEqual, type SplitResult } from "../src/lib/split";
import { computeBalances, settlementList, type SettleMember } from "../src/lib/settlement";
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
  split: (i) => {
    const ids = i.participants as string[];
    const values = (i.values ?? {}) as Record<string, number>;
    const amount = i.amount as number;
    let r: SplitResult;
    if (i.mode === "equal") r = splitEqual(amount, ids);
    else if (i.mode === "amount")
      r = splitByAmount(
        amount,
        ids.map((memberId) => ({ memberId, amount: values[memberId] })),
      );
    else if (i.mode === "percent")
      r = splitByPercent(
        amount,
        ids.map((memberId) => ({ memberId, bp: values[memberId] })),
      );
    else throw new Error(`Unknown split mode: ${String(i.mode)}`);
    if (r.ok) return { shares: Object.fromEntries(r.shares.map((s) => [s.memberId, s.amount])) };
    if (r.reason === "percentNot100") return { error: "percent_not_100", difference_bp: r.diffBp };
    return { error: "sum_mismatch", difference: r.diff };
  },
  settlement: (i) => {
    type M = { name: string; is_me?: boolean };
    type E = { paid_by: string; amount: number; splits: Record<string, number> };
    type S = { from: string; to: string; amount: number; paid?: boolean };
    const members: SettleMember[] = (i.members as M[]).map((m) => ({ id: m.name, name: m.name, isMe: m.is_me }));
    const balances = computeBalances({
      members,
      expenses: (i.expenses as E[]).map((e) => ({ paidBy: e.paid_by, amount: e.amount, shares: e.splits })),
      payments: ((i.settlements as S[] | undefined) ?? []).map((s) => ({
        from: s.from,
        to: s.to,
        amount: s.amount,
        paidAt: s.paid ? "paid" : null,
      })),
    });
    return {
      balances: Object.fromEntries(balances.map((b) => [b.memberId, b.balance])),
      transfers: settlementList(members, balances),
    };
  },
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
