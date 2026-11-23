import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { GroupError } from "../../lib/group/types";
import {
  createBankAccountRepository,
  createGroupRepository,
  createProfileRepository,
  createTransactionRepository,
} from "../repositories";
import { groupMembers, groups, settlementPayments, transactions } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";
import { eq } from "drizzle-orm";

const food = DEFAULT_CATEGORIES.find((c) => c.name === "Ăn uống")!.id;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const setup = () => {
  const { db, sqlite } = openTestDb();
  const d = db as unknown as AnyDb;
  return {
    db,
    sqlite,
    groups: createGroupRepository(d),
    profile: createProfileRepository(d),
    accounts: createBankAccountRepository(d),
    tx: createTransactionRepository(d),
  };
};
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as GroupError).code;
  }
  return null;
};
const tick = () => new Promise((r) => setTimeout(r, 3));
const acct = (no: string) => ({ bank_bin: "970436", account_no: no, account_name: "A" });

async function addExpense(
  s: ReturnType<typeof setup>,
  groupId: string,
  amount: number,
  extra: { type?: "expense" | "income"; paidBy?: string } = {},
) {
  const row = await s.tx.create({
    type: extra.type ?? "expense",
    amount,
    category_id: food,
    occurred_at: "2026-12-02T05:00:00Z",
  });
  s.db
    .update(transactions)
    .set({ group_id: groupId, paid_by_member_id: extra.paidBy ?? null })
    .where(eq(transactions.id, row.id))
    .run();
  return row.id;
}

describe("group repository", () => {
  it("AC1: creates a group with Tôi and named members, total 0", async () => {
    const s = setup();
    await s.profile.setDisplayName("Hoàng");
    const g = await s.groups.createGroup({
      name: " Đà Lạt ",
      start_date: "2026-12-01",
      end_date: "2026-12-04",
      members: ["An", "Bình"],
    });
    expect(g.id).toMatch(UUID);
    const [listed] = await s.groups.listGroups();
    expect(listed.id).toBe(g.id);
    expect(listed.name).toBe("Đà Lạt");
    expect(listed.total).toBe(0);
    expect(listed.start_date).toBe("2026-12-01");
    expect(listed.end_date).toBe("2026-12-04");
    expect(listed.members.map((m) => m.displayName)).toEqual(["Hoàng", "An", "Bình"]);
    expect(listed.members.map((m) => m.isMe)).toEqual([true, false, false]);
  });

  it("total sums only live expenses of that group", async () => {
    const s = setup();
    const a = await s.groups.createGroup({ name: "A" });
    const b = await s.groups.createGroup({ name: "B" });
    await addExpense(s, a.id, 100000);
    await addExpense(s, a.id, 50000);
    await addExpense(s, a.id, 999, { type: "income" });
    const gone = await addExpense(s, a.id, 7000);
    await s.tx.softDelete(gone);
    await addExpense(s, b.id, 1);
    const list = await s.groups.listGroups();
    expect(list.find((g) => g.id === a.id)?.total).toBe(150000);
    expect(list.find((g) => g.id === b.id)?.total).toBe(1);
  });

  it("AC2: receiving account defaults and can change", async () => {
    const s = setup();
    expect((await s.groups.createGroup({ name: "none" })).receiving_account_id).toBeNull();
    const a = await s.accounts.addAccount(acct("111"));
    const b = await s.accounts.addAccount(acct("222"));
    const g = await s.groups.createGroup({ name: "G" });
    expect(g.receiving_account_id).toBe(a.id);
    expect((await s.groups.updateGroup(g.id, { receiving_account_id: b.id })).receiving_account_id).toBe(b.id);
    expect(await code(s.groups.updateGroup(g.id, { receiving_account_id: "nope" }))).toBe("invalid_account");
    expect(await code(s.groups.createGroup({ name: "X", receiving_account_id: "nope" }))).toBe("invalid_account");
    await s.accounts.deleteAccount(b.id);
    expect(await code(s.groups.updateGroup(g.id, { receiving_account_id: b.id }))).toBe("invalid_account");
  });

  it("AC3: Tôi cannot be removed or renamed; profile rename shows up", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "G" });
    const me = g.members[0];
    expect(await code(s.groups.removeMember(me.id))).toBe("cannot_remove_me");
    expect(await code(s.groups.renameMember(me.id, "X"))).toBe("cannot_rename_me");
    await s.profile.setDisplayName("Minh");
    expect((await s.groups.getGroup(g.id)).members[0].displayName).toBe("Minh");
  });

  it("AC4: remove, guard by transactions, rename", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "G", members: ["An", "Bình"] });
    const [, an, binh] = g.members;
    await s.groups.removeMember(an.id);
    expect((await s.groups.getGroup(g.id)).members.map((m) => m.name)).toEqual(["", "Bình"]);
    expect(await code(s.groups.removeMember(an.id))).toBe("member_not_found");
    await addExpense(s, g.id, 10000, { paidBy: binh.id });
    expect(await code(s.groups.removeMember(binh.id))).toBe("member_has_transactions");
    expect((await s.groups.renameMember(binh.id, " Bình Lê ")).displayName).toBe("Bình Lê");
    expect(await code(s.groups.renameMember(binh.id, " "))).toBe("member_name_required");
    const added = await s.groups.addMember(g.id, "Chi");
    expect(added.displayName).toBe("Chi");
    expect(await code(s.groups.addMember(g.id, ""))).toBe("member_name_required");
  });

  it("removing a member with a settlement payment is blocked", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "G", members: ["An"] });
    const [me, an] = g.members;
    const now = "2026-11-20T00:00:00.000Z";
    s.db
      .insert(settlementPayments)
      .values({
        id: "p1",
        created_at: now,
        updated_at: now,
        group_id: g.id,
        member_id: an.id,
        amount: 1000,
        direction: "pay_to_me",
        paid_at: now,
      })
      .run();
    expect(me.is_me).toBe(true);
    expect(await code(s.groups.removeMember(an.id))).toBe("member_has_transactions");
  });

  it("AC5: empty name rejected, nothing inserted", async () => {
    const s = setup();
    expect(await code(s.groups.createGroup({ name: "  ", members: ["An"] }))).toBe("name_required");
    expect(s.db.select().from(groups).all()).toHaveLength(0);
    expect(s.db.select().from(groupMembers).all()).toHaveLength(0);
    const g = await s.groups.createGroup({ name: "G" });
    expect(await code(s.groups.updateGroup(g.id, { name: "" }))).toBe("name_required");
    expect((await s.groups.getGroup(g.id)).name).toBe("G");
  });

  it("AC6: deleteGroup soft deletes group, members and its transactions only", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "G", members: ["An"] });
    const other = await s.groups.createGroup({ name: "O" });
    const inGroup = await addExpense(s, g.id, 1000);
    const personal = await s.tx.create({
      type: "expense",
      amount: 2000,
      category_id: food,
      occurred_at: "2026-12-02T05:00:00Z",
    });
    const inOther = await addExpense(s, other.id, 3000);
    await s.groups.deleteGroup(g.id);
    expect((await s.groups.listGroups()).map((x) => x.id)).toEqual([other.id]);
    expect(await code(s.groups.getGroup(g.id))).toBe("not_found");
    expect(await code(s.groups.deleteGroup(g.id))).toBe("not_found");
    const members = s.db.select().from(groupMembers).where(eq(groupMembers.group_id, g.id)).all();
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.deleted_at)).toBe(true);
    const ids = (await s.tx.list()).map((t) => t.id);
    expect(ids).not.toContain(inGroup);
    expect(ids).toEqual(expect.arrayContaining([personal.id, inOther]));
    expect((await s.groups.getGroup(other.id)).members).toHaveLength(1);
  });

  it("rejects end before start; updated_at bumps on writes", async () => {
    const s = setup();
    expect(await code(s.groups.createGroup({ name: "G", start_date: "2026-12-05", end_date: "2026-12-01" }))).toBe(
      "invalid_dates",
    );
    const g = await s.groups.createGroup({ name: "G", start_date: "2026-12-05" });
    expect(await code(s.groups.updateGroup(g.id, { end_date: "2026-12-01" }))).toBe("invalid_dates");
    await tick();
    const u = await s.groups.updateGroup(g.id, { icon: "🏖" });
    expect(u.updated_at > g.updated_at).toBe(true);
    expect(u.icon).toBe("🏖");
  });

  it("allows only one live Tôi per group", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "G" });
    expect(() =>
      s.db.insert(groupMembers).values({ id: "dup", group_id: g.id, name: "", is_me: true }).run(),
    ).toThrow();
  });
});

describe("hasTransactions", () => {
  it("is true only for members who paid a live transaction", async () => {
    const s = setup();
    const g = await s.groups.createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
    const [, an, binh] = g.members;
    expect(g.members.map((m) => m.hasTransactions)).toEqual([false, false, false]);
    const txnId = await addExpense(s, g.id, 100000, { paidBy: an.id });
    const after = await s.groups.getGroup(g.id);
    expect(after.members.map((m) => [m.displayName, m.hasTransactions])).toEqual([
      ["", false],
      ["An", true],
      ["Bình", false],
    ]);
    expect(binh.id).toBe(after.members[2].id);
    await s.tx.softDelete(txnId);
    expect((await s.groups.getGroup(g.id)).members[1].hasTransactions).toBe(false);
  });
});
