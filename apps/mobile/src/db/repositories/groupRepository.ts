import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { GroupError } from "../../lib/group/types";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { bankAccount, expenseShares, groupMembers, groups, profile, transactions } from "../schema";
import type { AnyDb } from "../seed";

export type GroupRow = typeof groups.$inferSelect;
export type GroupMemberRow = typeof groupMembers.$inferSelect;

/** A member with the name to show. The UI appends "(Tôi)" when `isMe`. */
export type GroupMember = GroupMemberRow & {
  displayName: string;
  isMe: boolean;
  /** True when a live transaction was paid by this member; such members can't be removed. */
  hasTransactions: boolean;
};
export type GroupWithMembers = GroupRow & { members: GroupMember[] };
export type GroupSummary = GroupWithMembers & { total: number };

export type NewGroup = {
  name: string;
  icon?: string;
  /** `YYYY-MM-DD`. */
  start_date?: string | null;
  end_date?: string | null;
  /** Names of the other members; "Tôi" is always added. */
  members?: string[];
  receiving_account_id?: string | null;
};
export type GroupPatch = Partial<Omit<NewGroup, "members">>;

const liveGroup = isNull(groups.deleted_at);
const liveMember = isNull(groupMembers.deleted_at);

function cleanName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) throw new GroupError("name_required");
  return cleaned;
}

function checkDates(start: string | null | undefined, end: string | null | undefined): void {
  if (start && end && end < start) throw new GroupError("invalid_dates");
}

export function createGroupRepository(db: AnyDb) {
  async function myName(): Promise<string> {
    const rows = await db.select().from(profile).where(isNull(profile.deleted_at)).orderBy(asc(profile.created_at));
    return rows[0]?.display_name ?? "";
  }

  async function assertAccount(id: string | null | undefined): Promise<void> {
    if (!id) return;
    const rows = await db
      .select({ id: bankAccount.id })
      .from(bankAccount)
      .where(and(eq(bankAccount.id, id), isNull(bankAccount.deleted_at)));
    if (rows.length === 0) throw new GroupError("invalid_account");
  }

  async function defaultAccountId(): Promise<string | null> {
    const rows = await db
      .select({ id: bankAccount.id })
      .from(bankAccount)
      .where(and(eq(bankAccount.is_default, true), isNull(bankAccount.deleted_at)));
    return rows[0]?.id ?? null;
  }

  async function findGroupRow(id: string): Promise<GroupRow> {
    const rows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), liveGroup));
    if (rows.length === 0) throw new GroupError("not_found");
    return rows[0];
  }

  async function findMember(id: string): Promise<GroupMemberRow> {
    const rows = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.id, id), liveMember));
    if (rows.length === 0) throw new GroupError("member_not_found");
    return rows[0];
  }

  function present(rows: GroupMemberRow[], me: string, used: Set<string>): GroupMember[] {
    // Array sort is stable, so non-Tôi members keep insertion (rowid) order.
    return rows
      .map((m) => ({
        ...m,
        isMe: m.is_me,
        displayName: m.is_me ? me : m.name,
        hasTransactions: used.has(m.id),
      }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe));
  }

  async function membersOf(groupIds: string[]): Promise<Map<string, GroupMember[]>> {
    const map = new Map<string, GroupMember[]>();
    if (groupIds.length === 0) return map;
    const [rows, me] = await Promise.all([
      db
        .select()
        .from(groupMembers)
        .where(and(inArray(groupMembers.group_id, groupIds), liveMember))
        .orderBy(sql`rowid`),
      myName(),
    ]);
    const memberIds = rows.map((r) => r.id);
    const used = new Set<string>();
    if (memberIds.length > 0) {
      const paid = await db
        .select({ id: transactions.paid_by_member_id })
        .from(transactions)
        .where(and(inArray(transactions.paid_by_member_id, memberIds), isNull(transactions.deleted_at)))
        .groupBy(transactions.paid_by_member_id);
      for (const p of paid) if (p.id) used.add(p.id);
    }
    const byGroup = new Map<string, GroupMemberRow[]>();
    for (const r of rows) byGroup.set(r.group_id, [...(byGroup.get(r.group_id) ?? []), r]);
    for (const id of groupIds) map.set(id, present(byGroup.get(id) ?? [], me, used));
    return map;
  }

  async function getGroup(id: string): Promise<GroupWithMembers> {
    const row = await findGroupRow(id);
    return { ...row, members: (await membersOf([id])).get(id) ?? [] };
  }

  return {
    async createGroup(input: NewGroup): Promise<GroupWithMembers> {
      const name = cleanName(input.name);
      checkDates(input.start_date, input.end_date);
      const memberNames = (input.members ?? []).map((m) => m.trim()).filter(Boolean);
      let accountId: string | null;
      if (input.receiving_account_id) {
        await assertAccount(input.receiving_account_id);
        accountId = input.receiving_account_id;
      } else {
        accountId = await defaultAccountId();
      }
      const now = nowUtc();
      const id = newId();
      const memberRows = [
        { id: newId(), group_id: id, name: "", is_me: true, created_at: now, updated_at: now },
        ...memberNames.map((n) => ({
          id: newId(),
          group_id: id,
          name: n,
          is_me: false,
          created_at: now,
          updated_at: now,
        })),
      ];
      // Synchronous callback: works with both the expo-sqlite and better-sqlite3 drivers.
      (db as any).transaction((tx: any) => {
        tx.insert(groups)
          .values({
            id,
            created_at: now,
            updated_at: now,
            name,
            icon: input.icon ?? "",
            start_date: input.start_date ?? null,
            end_date: input.end_date ?? null,
            receiving_account_id: accountId,
          })
          .run();
        tx.insert(groupMembers).values(memberRows).run();
      });
      return getGroup(id);
    },

    async updateGroup(id: string, patch: GroupPatch): Promise<GroupWithMembers> {
      const current = await findGroupRow(id);
      const set: Partial<GroupRow> = { updated_at: nowUtc() };
      if (patch.name !== undefined) set.name = cleanName(patch.name);
      if (patch.icon !== undefined) set.icon = patch.icon;
      if (patch.start_date !== undefined) set.start_date = patch.start_date;
      if (patch.end_date !== undefined) set.end_date = patch.end_date;
      checkDates(set.start_date ?? current.start_date, set.end_date ?? current.end_date);
      if (patch.receiving_account_id !== undefined) {
        await assertAccount(patch.receiving_account_id);
        set.receiving_account_id = patch.receiving_account_id;
      }
      await db.update(groups).set(set).where(eq(groups.id, id));
      return getGroup(id);
    },

    /** Soft deletes the group with its live members and live transactions in one transaction. */
    async deleteGroup(id: string): Promise<void> {
      await findGroupRow(id);
      const now = nowUtc();
      const gone = { deleted_at: now, updated_at: now };
      (db as any).transaction((tx: any) => {
        tx.update(groups).set(gone).where(eq(groups.id, id)).run();
        tx.update(groupMembers)
          .set(gone)
          .where(and(eq(groupMembers.group_id, id), liveMember))
          .run();
        const txnIds = tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.group_id, id))
          .all()
          .map((r: { id: string }) => r.id);
        if (txnIds.length > 0) {
          tx.update(expenseShares)
            .set(gone)
            .where(and(inArray(expenseShares.transaction_id, txnIds), isNull(expenseShares.deleted_at)))
            .run();
        }
        tx.update(transactions)
          .set(gone)
          .where(and(eq(transactions.group_id, id), isNull(transactions.deleted_at)))
          .run();
      });
    },

    getGroup,

    /** Live groups (newest first) with members and `total`: integer VND of live expenses. */
    async listGroups(): Promise<GroupSummary[]> {
      const rows = await db.select().from(groups).where(liveGroup).orderBy(asc(groups.created_at));
      rows.reverse();
      const ids = rows.map((r) => r.id);
      const members = await membersOf(ids);
      const totals = new Map<string, number>();
      if (ids.length > 0) {
        const sums = await db
          .select({ group_id: transactions.group_id, total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(inArray(transactions.group_id, ids), isNull(transactions.deleted_at), eq(transactions.type, "expense")),
          )
          .groupBy(transactions.group_id);
        for (const s of sums) if (s.group_id) totals.set(s.group_id, Number(s.total));
      }
      return rows.map((r) => ({ ...r, members: members.get(r.id) ?? [], total: totals.get(r.id) ?? 0 }));
    },

    async addMember(groupId: string, name: string): Promise<GroupMember> {
      await findGroupRow(groupId);
      const cleaned = name.trim();
      if (!cleaned) throw new GroupError("member_name_required");
      const now = nowUtc();
      const id = newId();
      await db
        .insert(groupMembers)
        .values({ id, group_id: groupId, name: cleaned, is_me: false, created_at: now, updated_at: now });
      return (await getGroup(groupId)).members.find((m) => m.id === id) as GroupMember;
    },

    async renameMember(memberId: string, name: string): Promise<GroupMember> {
      const member = await findMember(memberId);
      if (member.is_me) throw new GroupError("cannot_rename_me");
      const cleaned = name.trim();
      if (!cleaned) throw new GroupError("member_name_required");
      await db.update(groupMembers).set({ name: cleaned, updated_at: nowUtc() }).where(eq(groupMembers.id, memberId));
      return (await getGroup(member.group_id)).members.find((m) => m.id === memberId) as GroupMember;
    },

    async removeMember(memberId: string): Promise<void> {
      const member = await findMember(memberId);
      if (member.is_me) throw new GroupError("cannot_remove_me");
      const used = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.paid_by_member_id, memberId), isNull(transactions.deleted_at)))
        .limit(1);
      const shared = await db
        .select({ id: expenseShares.id })
        .from(expenseShares)
        .where(and(eq(expenseShares.member_id, memberId), isNull(expenseShares.deleted_at)))
        .limit(1);
      if (used.length > 0 || shared.length > 0) throw new GroupError("member_has_transactions");
      const now = nowUtc();
      await db.update(groupMembers).set({ deleted_at: now, updated_at: now }).where(eq(groupMembers.id, memberId));
    },
  };
}

export type GroupRepository = ReturnType<typeof createGroupRepository>;
