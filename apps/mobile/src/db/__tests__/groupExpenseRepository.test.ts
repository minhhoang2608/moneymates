import { and, eq, isNull } from "drizzle-orm";

import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { GroupError } from "../../lib/group/types";
import { monthTotals } from "../../lib/stats/monthTotals";
import {
  createGroupExpenseRepository,
  createGroupRepository,
  createProfileRepository,
  createTransactionRepository,
} from "../repositories";
import { expenseShares, transactions } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const food = DEFAULT_CATEGORIES.find((c) => c.name === "Ăn uống")!.id;
const other = DEFAULT_CATEGORIES.find((c) => c.name === "Khác" && c.type === "expense")!.id;

async function setup() {
  const { db } = openTestDb();
  const d = db as unknown as AnyDb;
  const groups = createGroupRepository(d);
  const exp = createGroupExpenseRepository(d);
  const tx = createTransactionRepository(d);
  await createProfileRepository(d).setDisplayName("Hoàng");
  const g = await groups.createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
  const [me, an, binh] = g.members.map((m) => m.id);
  return { db, groups, exp, tx, g, me, an, binh };
}
const amounts = (rows: { amount: number }[]) => rows.map((r) => r.amount);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as GroupError).code;
  }
  return null;
};
const base = { occurredAt: "2026-11-20T08:00:00Z" };

describe("group expense repository", () => {
  it("AC1: equal split among 3, Tôi first with the remainder", async () => {
    const s = await setup();
    const t = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 1000000,
      payerMemberId: s.me,
      splitMode: "equal",
      shares: [{ memberId: s.binh }, { memberId: s.me }, { memberId: s.an }],
    });
    expect(t.split_mode).toBe("equal");
    expect(t.paid_by_member_id).toBe(s.me);
    expect(t.category_id).toBe(other);
    const shares = await s.exp.getShares(t.id);
    expect(amounts(shares)).toEqual([333334, 333333, 333333]);
    expect(shares.map((x) => x.member_id)).toEqual([s.me, s.an, s.binh]);
    expect(await s.exp.groupTotal(s.g.id)).toBe(1000000);
  });

  it("AC2: unticked member gets no share", async () => {
    const s = await setup();
    const t = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 300000,
      payerMemberId: s.an,
      splitMode: "equal",
      shares: [{ memberId: s.me }, { memberId: s.an }],
    });
    const shares = await s.exp.getShares(t.id);
    expect(amounts(shares)).toEqual([150000, 150000]);
    expect(shares.some((x) => x.member_id === s.binh)).toBe(false);
  });

  it("AC3: invalid amount and percent splits are rejected and nothing is inserted", async () => {
    const s = await setup();
    const mk = (splitMode: "amount" | "percent", shares: any[], amount = 500000) =>
      s.exp.createGroupExpense({ ...base, groupId: s.g.id, amount, payerMemberId: s.me, splitMode, shares });
    try {
      await mk("amount", [
        { memberId: s.me, amount: 200000 },
        { memberId: s.an, amount: 250000 },
      ]);
      throw new Error("should fail");
    } catch (e) {
      expect((e as GroupError).code).toBe("invalid_split");
      expect((e as GroupError).reason).toBe("short");
      expect((e as GroupError).diff).toBe(50000);
    }
    expect(
      await code(
        mk("percent", [
          { memberId: s.me, bp: 5000 },
          { memberId: s.an, bp: 4000 },
        ]),
      ),
    ).toBe("invalid_split");
    expect(s.db.select().from(transactions).all()).toHaveLength(0);
    expect(s.db.select().from(expenseShares).all()).toHaveLength(0);

    const ok = await mk("amount", [
      { memberId: s.me, amount: 200000 },
      { memberId: s.an, amount: 300000 },
    ]);
    const stored = await s.exp.getShares(ok.id);
    expect(amounts(stored)).toEqual([200000, 300000]);
    expect(stored.map((x) => x.value)).toEqual([200000, 300000]);

    const pct = await mk(
      "percent",
      [
        { memberId: s.me, bp: 5000 },
        { memberId: s.an, bp: 3000 },
        { memberId: s.binh, bp: 2000 },
      ],
      1000000,
    );
    const ps = await s.exp.getShares(pct.id);
    expect(amounts(ps)).toEqual([500000, 300000, 200000]);
    expect(ps.map((x) => x.value)).toEqual([5000, 3000, 2000]);
  });

  it("AC4: my share by month, any payer, VN month boundary, excludes deleted", async () => {
    const s = await setup();
    const four = await s.groups.addMember(s.g.id, "Chi");
    const all = [s.me, s.an, s.binh, four.id].map((memberId) => ({ memberId }));
    const mk = (payer: string, occurredAt: string, amount = 1000000) =>
      s.exp.createGroupExpense({
        groupId: s.g.id,
        amount,
        payerMemberId: payer,
        splitMode: "equal",
        shares: all,
        occurredAt,
      });
    const a = await mk(s.me, "2026-11-20T08:00:00Z");
    expect(await s.exp.myShareByMonth("2026-11")).toBe(250000);
    await s.tx.softDelete(a.id);
    expect(await s.exp.myShareByMonth("2026-11")).toBe(0);
    await mk(s.an, "2026-11-20T08:00:00Z");
    expect(await s.exp.myShareByMonth("2026-11")).toBe(250000);
    await mk(s.an, "2026-10-31T17:00:00Z", 400000); // Nov 1 in Vietnam
    expect(await s.exp.myShareByMonth("2026-11")).toBe(350000);
    await mk(s.an, "2026-10-31T16:59:00Z", 400000); // Oct 31 in Vietnam
    expect(await s.exp.myShareByMonth("2026-11")).toBe(350000);
    expect(await s.exp.myShareByMonth("2026-10")).toBe(100000);
  });

  it("AC5: update recomputes shares and soft-deletes the old rows", async () => {
    const s = await setup();
    const t = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 1000000,
      payerMemberId: s.me,
      splitMode: "equal",
      shares: [{ memberId: s.me }, { memberId: s.an }, { memberId: s.binh }],
    });
    await s.exp.updateGroupExpense(t.id, { amount: 1000001 });
    const shares = await s.exp.getShares(t.id);
    expect(amounts(shares)).toEqual([333334, 333334, 333333]);
    expect(shares.reduce((a, x) => a + x.amount, 0)).toBe(1000001);
    const dead = s.db
      .select()
      .from(expenseShares)
      .where(and(eq(expenseShares.transaction_id, t.id)))
      .all()
      .filter((r) => r.deleted_at !== null);
    expect(dead).toHaveLength(3);

    const p = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 1000000,
      payerMemberId: s.me,
      splitMode: "percent",
      shares: [
        { memberId: s.me, bp: 3334 },
        { memberId: s.an, bp: 3333 },
        { memberId: s.binh, bp: 3333 },
      ],
    });
    await s.exp.updateGroupExpense(p.id, { amount: 999999 });
    const ps = await s.exp.getShares(p.id);
    expect(ps.reduce((a, x) => a + x.amount, 0)).toBe(999999);

    const m = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 100,
      payerMemberId: s.me,
      splitMode: "amount",
      shares: [
        { memberId: s.me, amount: 40 },
        { memberId: s.an, amount: 60 },
      ],
    });
    expect(await code(s.exp.updateGroupExpense(m.id, { amount: 200 }))).toBe("invalid_split");
    await s.exp.updateGroupExpense(m.id, {
      amount: 200,
      shares: [
        { memberId: s.me, amount: 100 },
        { memberId: s.an, amount: 100 },
      ],
    });
    expect(amounts(await s.exp.getShares(m.id))).toEqual([100, 100]);
  });

  it("AC6: personalOnly excludes group rows and reproduces the golden monthly total", async () => {
    const s = await setup();
    const personal = [
      ["expense", 55000, "2026-11-03T05:00:00Z"],
      ["expense", 87000, "2026-11-10T12:00:00Z"],
      ["income", 25000000, "2026-11-05T02:00:00Z"],
      ["expense", 999000, "2026-10-31T16:00:00Z"],
    ] as const;
    for (const [type, amount, occurred_at] of personal) {
      await s.tx.create({ type, amount, category_id: food, occurred_at });
    }
    await s.exp.createGroupExpense({
      groupId: s.g.id,
      amount: 1000000,
      payerMemberId: s.me,
      splitMode: "equal",
      shares: [{ memberId: s.me }, { memberId: s.an }, { memberId: s.binh }, { memberId: s.me }].slice(0, 3),
      occurredAt: "2026-11-20T08:00:00Z",
    });
    const rows = await s.tx.list({ personalOnly: true });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.group_id === null)).toBe(true);
    // Equal among 4 for the golden numbers: 250000 + 50000 (200000 split by 4).
    const four = await s.groups.addMember(s.g.id, "Chi");
    const all = [s.me, s.an, s.binh, four.id].map((memberId) => ({ memberId }));
    await s.exp.createGroupExpense({
      groupId: s.g.id,
      amount: 1000000,
      payerMemberId: s.me,
      splitMode: "equal",
      shares: all,
      occurredAt: "2026-11-21T08:00:00Z",
    });
    const myShares = await s.exp.mySharesInMonth("2026-11");
    const stat = rows.map((r) => ({ type: r.type, amount: r.amount, occurredAt: r.occurred_at }));
    const totals = monthTotals(stat, myShares, "2026-11");
    expect(totals.incomeTotal).toBe(25000000);
    expect(totals.expenseTotal).toBe(142000 + myShares.reduce((a, x) => a + x.amount, 0));
    expect(myShares.map((x) => x.amount)).toEqual([333334, 250000]);
  });

  it("rejects payer or share members from another group, bad amounts, dead groups", async () => {
    const s = await setup();
    const other = await s.groups.createGroup({ name: "Khác", members: ["Z"] });
    const z = other.members[1].id;
    const mk = (payer: string, ids: string[], amount = 1000) =>
      s.exp.createGroupExpense({
        ...base,
        groupId: s.g.id,
        amount,
        payerMemberId: payer,
        splitMode: "equal",
        shares: ids.map((memberId) => ({ memberId })),
      });
    expect(await code(mk(z, [s.me]))).toBe("invalid_payer");
    expect(await code(mk(s.me, [s.me, z]))).toBe("invalid_share_member");
    expect(await code(mk(s.me, [s.me], 0))).toBe("invalid_amount");
    expect(await code(mk(s.me, [s.me], 1.5))).toBe("invalid_amount");
    await s.groups.deleteGroup(s.g.id);
    expect(await code(mk(s.me, [s.me]))).toBe("not_found");
  });

  it("each mode keeps sum(shares) == amount", async () => {
    const s = await setup();
    for (let amount = 1; amount < 60; amount += 7) {
      const eq3 = await s.exp.createGroupExpense({
        ...base,
        groupId: s.g.id,
        amount,
        payerMemberId: s.me,
        splitMode: "equal",
        shares: [{ memberId: s.me }, { memberId: s.an }, { memberId: s.binh }],
      });
      const pc = await s.exp.createGroupExpense({
        ...base,
        groupId: s.g.id,
        amount,
        payerMemberId: s.me,
        splitMode: "percent",
        shares: [
          { memberId: s.me, bp: 3333 },
          { memberId: s.an, bp: 3333 },
          { memberId: s.binh, bp: 3334 },
        ],
      });
      for (const t of [eq3, pc]) {
        expect((await s.exp.getShares(t.id)).reduce((a, x) => a + x.amount, 0)).toBe(amount);
      }
    }
  });

  it("removeMember is refused with shares; deleteGroup cascades to shares", async () => {
    const s = await setup();
    const t = await s.exp.createGroupExpense({
      ...base,
      groupId: s.g.id,
      amount: 900,
      payerMemberId: s.me,
      splitMode: "equal",
      shares: [{ memberId: s.me }, { memberId: s.an }],
    });
    expect(await code(s.groups.removeMember(s.an))).toBe("member_has_transactions");
    await s.groups.deleteGroup(s.g.id);
    const live = s.db
      .select()
      .from(expenseShares)
      .where(and(eq(expenseShares.transaction_id, t.id), isNull(expenseShares.deleted_at)))
      .all();
    expect(live).toHaveLength(0);
    expect(await s.exp.myShareByMonth("2026-11")).toBe(0);
  });

  it("listGroupExpenses: this group's live expenses, newest first, with share_count", async () => {
    const s = await setup();
    const other = await s.groups.createGroup({ name: "Khác nhóm", members: ["Chi"] });
    const mk = (groupId: string, payer: string, shares: string[], amount: number, occurredAt: string) =>
      s.exp.createGroupExpense({
        groupId,
        amount,
        payerMemberId: payer,
        splitMode: "equal",
        shares: shares.map((memberId) => ({ memberId })),
        occurredAt,
      });
    const old = await mk(s.g.id, s.me, [s.me, s.an, s.binh], 300000, "2026-11-19T08:00:00Z");
    const recent = await mk(s.g.id, s.an, [s.me, s.an], 200000, "2026-11-21T08:00:00Z");
    const gone = await mk(s.g.id, s.me, [s.me], 100000, "2026-11-20T08:00:00Z");
    await mk(other.id, other.members[0].id, [other.members[0].id], 50000, "2026-11-22T08:00:00Z");
    await s.tx.softDelete(gone.id);
    const rows = await s.exp.listGroupExpenses(s.g.id);
    expect(rows.map((r) => r.id)).toEqual([recent.id, old.id]);
    expect(rows.map((r) => r.share_count)).toEqual([2, 3]);
    expect(await s.exp.listGroupExpenses(other.id)).toHaveLength(1);
  });
});
