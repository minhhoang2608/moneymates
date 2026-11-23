import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { GroupError } from "../../lib/group/types";
import { monthBounds } from "../../lib/history/filter";
import { splitByAmount, splitByPercent, splitEqual, type SplitResult } from "../../lib/split";
import type { MyShare } from "../../lib/stats/monthTotals";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { expenseShares, groupMembers, groups, transactions } from "../schema";
import type { AnyDb } from "../seed";

export type ExpenseShareRow = typeof expenseShares.$inferSelect;
export type GroupExpenseListRow = typeof transactions.$inferSelect & { share_count: number };
export type SplitMode = "equal" | "amount" | "percent";

/** equal → `{memberId}`, amount → `{memberId, amount}`, percent → `{memberId, bp}` (10000 = 100%). */
export type ShareInput = { memberId: string; amount?: number; bp?: number };

export type NewGroupExpense = {
  groupId: string;
  /** Integer VND, > 0. */
  amount: number;
  payerMemberId: string;
  splitMode: SplitMode;
  shares: ShareInput[];
  /** Any parseable date; stored as ISO UTC. */
  occurredAt: string;
  categoryId?: string;
  note?: string;
};

export type GroupExpensePatch = Partial<Omit<NewGroupExpense, "groupId">>;

const OTHER_CATEGORY = DEFAULT_CATEGORIES.find((c) => c.name === "Khác" && c.type === "expense")!.id;
const MODES: string[] = ["equal", "amount", "percent"];

const liveTxn = isNull(transactions.deleted_at);
const liveShare = isNull(expenseShares.deleted_at);
const liveMember = isNull(groupMembers.deleted_at);

function invalidSplit(r: Extract<SplitResult, { ok: false }>): GroupError {
  return new GroupError("invalid_split", {
    reason: r.reason,
    diff: r.reason === "percentNot100" ? r.diffBp : r.diff,
  });
}

function checkAmount(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new GroupError("invalid_amount");
  }
  return amount;
}

function checkOccurredAt(value: unknown): string {
  const ms = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  if (Number.isNaN(ms)) throw new GroupError("invalid_split", { reason: "invalid_occurred_at" });
  return new Date(ms).toISOString();
}

export function createGroupExpenseRepository(db: AnyDb) {
  /** Live members of a group in display order: Tôi first, then insertion order. */
  async function orderedMembers(groupId: string): Promise<{ id: string; is_me: boolean }[]> {
    const rows = await db
      .select({ id: groupMembers.id, is_me: groupMembers.is_me })
      .from(groupMembers)
      .where(and(eq(groupMembers.group_id, groupId), liveMember))
      .orderBy(sql`rowid`);
    return [...rows].sort((a, b) => Number(b.is_me) - Number(a.is_me));
  }

  async function requireGroupExpense(id: string) {
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), liveTxn));
    const row = rows[0];
    if (!row || !row.group_id || !row.split_mode) throw new GroupError("not_group_expense");
    return row;
  }

  /** Validates members and computes shares + stored raw values. */
  function computeShares(
    amount: number,
    mode: SplitMode,
    inputs: ShareInput[],
    members: { id: string }[],
    payerId: string,
  ): { memberId: string; amount: number; value: number | null }[] {
    const ids = new Set(members.map((m) => m.id));
    if (!ids.has(payerId)) throw new GroupError("invalid_payer");
    if (inputs.length === 0) throw new GroupError("invalid_split", { reason: "no_shares", diff: 0 });
    for (const s of inputs) if (!ids.has(s.memberId)) throw new GroupError("invalid_share_member");
    if (new Set(inputs.map((s) => s.memberId)).size !== inputs.length) {
      throw new GroupError("invalid_split", { reason: "duplicate_member", diff: 0 });
    }
    const order = new Map(members.map((m, i) => [m.id, i]));
    const sorted = [...inputs].sort((a, b) => order.get(a.memberId)! - order.get(b.memberId)!);
    const valueOf = new Map<string, number | null>();
    let result: SplitResult;
    try {
      if (mode === "equal") {
        for (const s of sorted) valueOf.set(s.memberId, null);
        result = splitEqual(
          amount,
          sorted.map((s) => s.memberId),
        );
      } else if (mode === "amount") {
        for (const s of sorted) valueOf.set(s.memberId, s.amount ?? NaN);
        result = splitByAmount(
          amount,
          sorted.map((s) => ({ memberId: s.memberId, amount: s.amount as number })),
        );
      } else {
        for (const s of sorted) valueOf.set(s.memberId, s.bp ?? NaN);
        result = splitByPercent(
          amount,
          sorted.map((s) => ({ memberId: s.memberId, bp: s.bp as number })),
        );
      }
    } catch {
      throw new GroupError("invalid_split", { reason: "invalid_value", diff: 0 });
    }
    if (!result.ok) throw invalidSplit(result);
    return result.shares.map((s) => ({ ...s, value: valueOf.get(s.memberId) ?? null }));
  }

  function shareRows(txnId: string, rows: { memberId: string; amount: number; value: number | null }[], now: string) {
    return rows.map((r) => ({
      id: newId(),
      created_at: now,
      updated_at: now,
      transaction_id: txnId,
      member_id: r.memberId,
      amount: r.amount,
      value: r.value,
    }));
  }

  async function getShares(txnId: string): Promise<ExpenseShareRow[]> {
    const rows = await db
      .select({ share: expenseShares, is_me: groupMembers.is_me })
      .from(expenseShares)
      .innerJoin(groupMembers, eq(groupMembers.id, expenseShares.member_id))
      .where(and(eq(expenseShares.transaction_id, txnId), liveShare))
      .orderBy(sql`group_members.rowid`);
    return rows.sort((a, b) => Number(b.is_me) - Number(a.is_me)).map((r) => r.share);
  }

  async function mySharesInMonth(month: string): Promise<MyShare[]> {
    const { from, to } = monthBounds(month);
    const rows = await db
      .select({
        amount: expenseShares.amount,
        occurredAt: transactions.occurred_at,
        categoryId: transactions.category_id,
      })
      .from(expenseShares)
      .innerJoin(transactions, eq(transactions.id, expenseShares.transaction_id))
      .innerJoin(groupMembers, eq(groupMembers.id, expenseShares.member_id))
      .where(
        and(
          liveShare,
          liveTxn,
          eq(groupMembers.is_me, true),
          eq(transactions.type, "expense"),
          gte(transactions.occurred_at, from),
          lt(transactions.occurred_at, to),
        ),
      )
      .orderBy(asc(transactions.occurred_at));
    return rows.map((r) => ({ amount: Number(r.amount), occurredAt: r.occurredAt, categoryId: r.categoryId }));
  }

  return {
    async createGroupExpense(input: NewGroupExpense) {
      const amount = checkAmount(input.amount);
      if (!MODES.includes(input.splitMode)) throw new GroupError("invalid_split", { reason: "mode" });
      const occurred_at = checkOccurredAt(input.occurredAt);
      const groupRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, input.groupId), isNull(groups.deleted_at)));
      if (groupRows.length === 0) throw new GroupError("not_found");
      const members = await orderedMembers(input.groupId);
      const computed = computeShares(amount, input.splitMode, input.shares, members, input.payerMemberId);
      const now = nowUtc();
      const id = newId();
      (db as any).transaction((tx: any) => {
        tx.insert(transactions)
          .values({
            id,
            created_at: now,
            updated_at: now,
            type: "expense",
            amount,
            currency: "VND",
            category_id: input.categoryId ?? OTHER_CATEGORY,
            note: (input.note ?? "").trim(),
            occurred_at,
            group_id: input.groupId,
            paid_by_member_id: input.payerMemberId,
            split_mode: input.splitMode,
          })
          .run();
        tx.insert(expenseShares)
          .values(shareRows(id, computed, now))
          .run();
      });
      const rows = await db.select().from(transactions).where(eq(transactions.id, id));
      return rows[0];
    },

    /**
     * Updates a group expense. The shares are always recomputed from the split module.
     * Without new `shares`, equal/percent reuse the stored members and values; amount mode needs new parts.
     */
    async updateGroupExpense(txnId: string, patch: GroupExpensePatch) {
      const current = await requireGroupExpense(txnId);
      const amount = patch.amount !== undefined ? checkAmount(patch.amount) : current.amount;
      const mode = (patch.splitMode ?? current.split_mode) as SplitMode;
      if (!MODES.includes(mode)) throw new GroupError("invalid_split", { reason: "mode" });
      const payer = patch.payerMemberId ?? (current.paid_by_member_id as string);
      const members = await orderedMembers(current.group_id as string);

      let inputs = patch.shares;
      if (!inputs) {
        if (mode !== current.split_mode) throw new GroupError("invalid_split", { reason: "needs_shares", diff: 0 });
        const stored = await getShares(txnId);
        if (mode === "amount") {
          if (amount !== current.amount) throw new GroupError("invalid_split", { reason: "needs_shares", diff: 0 });
          inputs = stored.map((s) => ({ memberId: s.member_id, amount: s.amount }));
        } else if (mode === "percent") {
          inputs = stored.map((s) => ({ memberId: s.member_id, bp: s.value as number }));
        } else {
          inputs = stored.map((s) => ({ memberId: s.member_id }));
        }
      }
      const computed = computeShares(amount, mode, inputs, members, payer);
      const now = nowUtc();
      const set: Partial<typeof transactions.$inferInsert> = {
        updated_at: now,
        amount,
        split_mode: mode,
        paid_by_member_id: payer,
      };
      if (patch.occurredAt !== undefined) set.occurred_at = checkOccurredAt(patch.occurredAt);
      if (patch.note !== undefined) set.note = patch.note.trim();
      if (patch.categoryId !== undefined) set.category_id = patch.categoryId;
      (db as any).transaction((tx: any) => {
        tx.update(transactions).set(set).where(eq(transactions.id, txnId)).run();
        tx.update(expenseShares)
          .set({ deleted_at: now, updated_at: now })
          .where(and(eq(expenseShares.transaction_id, txnId), liveShare))
          .run();
        tx.insert(expenseShares)
          .values(shareRows(txnId, computed, now))
          .run();
      });
      const rows = await db.select().from(transactions).where(eq(transactions.id, txnId));
      return rows[0];
    },

    /** Live shares of an expense, Tôi first then member order. */
    getShares,

    /** Sum of live expenses of a group (integer VND). */
    async groupTotal(groupId: string): Promise<number> {
      const rows = await db
        .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(and(eq(transactions.group_id, groupId), liveTxn, eq(transactions.type, "expense")));
      return Number(rows[0]?.total ?? 0);
    },

    /** Live expenses of a group, newest first, with the number of live shares. */
    async listGroupExpenses(groupId: string): Promise<GroupExpenseListRow[]> {
      const rows = await db
        .select({
          txn: transactions,
          share_count: sql<number>`(select count(*) from expense_shares es where es.transaction_id = transactions.id and es.deleted_at is null)`,
        })
        .from(transactions)
        .where(and(eq(transactions.group_id, groupId), liveTxn, eq(transactions.type, "expense")))
        .orderBy(desc(transactions.occurred_at), desc(sql`transactions.rowid`));
      return rows.map((r) => ({ ...r.txn, share_count: Number(r.share_count) }));
    },

    /** My (is_me) share of live group expenses in a VN local month `YYYY-MM`, integer VND. */
    async myShareByMonth(month: string): Promise<number> {
      return (await mySharesInMonth(month)).reduce((s, x) => s + x.amount, 0);
    },

    mySharesInMonth,
  };
}

export type GroupExpenseRepository = ReturnType<typeof createGroupExpenseRepository>;
