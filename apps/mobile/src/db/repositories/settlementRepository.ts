import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { GroupError } from "../../lib/group/types";
import {
  computeBalances,
  settlementList,
  type GroupExpense,
  type SettleMember,
  type SettlementItem,
  type SettlementPayment,
} from "../../lib/settlement";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { expenseShares, groupMembers, groups, settlementPayments, transactions } from "../schema";
import type { AnyDb } from "../seed";

export type SettlementPaymentRow = typeof settlementPayments.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;

export type GroupSettlementRow = {
  memberId: string;
  isMe: boolean;
  paid: number;
  owed: number;
  balance: number;
};

export type GroupSettlementSummary = { rows: GroupSettlementRow[]; items: SettlementItem[] };

export type MemberExpense = { transaction: TransactionRow; paidByMe: boolean; myShare: number };

export function createSettlementRepository(db: AnyDb) {
  async function requireGroup(groupId: string) {
    const rows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deleted_at)));
    if (rows.length === 0) throw new GroupError("not_found");
  }

  /** Live members: Tôi first, then insertion order. */
  async function orderedMembers(groupId: string) {
    const rows = await db
      .select({ id: groupMembers.id, is_me: groupMembers.is_me })
      .from(groupMembers)
      .where(and(eq(groupMembers.group_id, groupId), isNull(groupMembers.deleted_at)))
      .orderBy(sql`rowid`);
    return [...rows].sort((a, b) => Number(b.is_me) - Number(a.is_me));
  }

  async function summary(groupId: string): Promise<GroupSettlementSummary> {
    await requireGroup(groupId);
    const members = await orderedMembers(groupId);
    const me = members.find((m) => m.is_me);
    const settleMembers: SettleMember[] = members.map((m) => ({ id: m.id, name: "", isMe: m.is_me }));

    const txns = await db
      .select({ id: transactions.id, amount: transactions.amount, paidBy: transactions.paid_by_member_id })
      .from(transactions)
      .where(
        and(eq(transactions.group_id, groupId), eq(transactions.type, "expense"), isNull(transactions.deleted_at)),
      );
    const shares = txns.length
      ? await db
          .select({
            transaction_id: expenseShares.transaction_id,
            member_id: expenseShares.member_id,
            amount: expenseShares.amount,
          })
          .from(expenseShares)
          .where(
            and(
              inArray(
                expenseShares.transaction_id,
                txns.map((t) => t.id),
              ),
              isNull(expenseShares.deleted_at),
            ),
          )
      : [];
    const sharesOf = new Map<string, Record<string, number>>();
    for (const s of shares) {
      const rec = sharesOf.get(s.transaction_id) ?? {};
      rec[s.member_id] = (rec[s.member_id] ?? 0) + Number(s.amount);
      sharesOf.set(s.transaction_id, rec);
    }
    const expenses: GroupExpense[] = txns
      .filter((t) => t.paidBy)
      .map((t) => ({ paidBy: t.paidBy as string, amount: Number(t.amount), shares: sharesOf.get(t.id) ?? {} }));

    const paymentRows = await db
      .select()
      .from(settlementPayments)
      .where(and(eq(settlementPayments.group_id, groupId), isNull(settlementPayments.deleted_at)));
    const payments: SettlementPayment[] = me
      ? paymentRows.map((p) =>
          p.direction === "pay_to_me"
            ? { from: p.member_id, to: me.id, amount: Number(p.amount), paidAt: p.paid_at }
            : { from: me.id, to: p.member_id, amount: Number(p.amount), paidAt: p.paid_at },
        )
      : [];

    const balances = computeBalances({ members: settleMembers, expenses, payments });
    const isMe = new Map(members.map((m) => [m.id, m.is_me]));
    return {
      rows: balances.map((b) => ({ ...b, isMe: isMe.get(b.memberId) ?? false })),
      items: me ? settlementList(settleMembers, balances) : [],
    };
  }

  return {
    getGroupSummary: summary,

    /** Records that `memberId` paid me (balance < 0) or I paid them (balance > 0). Partial payments are allowed. */
    async markPaid(groupId: string, memberId: string, amount: number): Promise<SettlementPaymentRow> {
      await requireGroup(groupId);
      const members = await orderedMembers(groupId);
      const member = members.find((m) => m.id === memberId);
      if (!member || member.is_me) throw new GroupError("member_not_found");
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
        throw new GroupError("invalid_amount");
      }
      const { rows } = await summary(groupId);
      const balance = rows.find((r) => r.memberId === memberId)?.balance ?? 0;
      if (balance === 0) throw new GroupError("nothing_to_settle");
      if (amount > Math.abs(balance)) throw new GroupError("invalid_amount");
      const now = nowUtc();
      const id = newId();
      await db.insert(settlementPayments).values({
        id,
        created_at: now,
        updated_at: now,
        group_id: groupId,
        member_id: memberId,
        amount,
        currency: "VND",
        direction: balance < 0 ? "pay_to_me" : "pay_from_me",
        paid_at: now,
      });
      const out = await db.select().from(settlementPayments).where(eq(settlementPayments.id, id));
      return out[0];
    },

    /** Live group expenses the member paid or has a share in, newest first. `myShare` is that member's share. */
    async listMemberExpenses(groupId: string, memberId: string): Promise<MemberExpense[]> {
      await requireGroup(groupId);
      const shareRows = await db
        .select({ transaction_id: expenseShares.transaction_id, amount: expenseShares.amount })
        .from(expenseShares)
        .where(and(eq(expenseShares.member_id, memberId), isNull(expenseShares.deleted_at)));
      const shareOf = new Map(shareRows.map((s) => [s.transaction_id, Number(s.amount)]));
      const ids = [...shareOf.keys()];
      const rows = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.group_id, groupId),
            eq(transactions.type, "expense"),
            isNull(transactions.deleted_at),
            or(eq(transactions.paid_by_member_id, memberId), ids.length ? inArray(transactions.id, ids) : sql`0`),
          ),
        )
        .orderBy(desc(transactions.occurred_at), desc(sql`rowid`));
      return rows.map((t) => ({
        transaction: t,
        paidByMe: t.paid_by_member_id === memberId,
        myShare: shareOf.get(t.id) ?? 0,
      }));
    },
  };
}

export type SettlementRepository = ReturnType<typeof createSettlementRepository>;
