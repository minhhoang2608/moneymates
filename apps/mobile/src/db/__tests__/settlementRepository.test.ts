import { eq } from "drizzle-orm";

import { GroupError } from "../../lib/group/types";
import { formatSettlementItem } from "../../lib/settlement";
import {
  createGroupExpenseRepository,
  createGroupRepository,
  createProfileRepository,
  createSettlementRepository,
  createTransactionRepository,
} from "../repositories";
import { settlementPayments } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

async function setup() {
  const { db } = openTestDb();
  const d = db as unknown as AnyDb;
  const groups = createGroupRepository(d);
  const exp = createGroupExpenseRepository(d);
  const tx = createTransactionRepository(d);
  const st = createSettlementRepository(d);
  await createProfileRepository(d).setDisplayName("Hoàng");
  const g = await groups.createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
  const [me, an, binh] = g.members.map((m) => m.id);
  const names: Record<string, string> = { [me]: "Tôi", [an]: "An", [binh]: "Bình" };
  const spend = (amount: number, payer: string, who: string[] = [me, an, binh], at = "2026-11-20T08:00:00Z") =>
    exp.createGroupExpense({
      groupId: g.id,
      amount,
      payerMemberId: payer,
      splitMode: "equal",
      shares: who.map((memberId) => ({ memberId })),
      occurredAt: at,
    });
  const text = async () =>
    (await st.getGroupSummary(g.id)).items.map((i) => formatSettlementItem(i, (id) => names[id]));
  const bal = async (id: string) => (await st.getGroupSummary(g.id)).rows.find((r) => r.memberId === id)!;
  return { db, d, groups, exp, tx, st, g, me, an, binh, spend, text, bal };
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as GroupError).code;
  }
  return null;
};

describe("settlement repository", () => {
  it("AC1: summary rows and items", async () => {
    const s = await setup();
    await s.spend(900000, s.me);
    await s.spend(300000, s.binh);
    const { rows } = await s.st.getGroupSummary(s.g.id);
    expect(rows.map((r) => [r.isMe, r.paid, r.owed, r.balance])).toEqual([
      [true, 900000, 400000, 500000],
      [false, 0, 400000, -400000],
      [false, 300000, 400000, -100000],
    ]);
    expect(rows.reduce((a, r) => a + r.balance, 0)).toBe(0);
    expect(await s.text()).toEqual(["An trả Tôi 400.000đ", "Bình trả Tôi 100.000đ"]);
  });

  it("AC1: variant where only Bình pays", async () => {
    const s = await setup();
    await s.spend(600000, s.binh);
    expect(await s.text()).toEqual(["An trả Tôi 200.000đ", "Tôi trả Bình 400.000đ"]);
  });

  it("AC2: markPaid zeroes one member only", async () => {
    const s = await setup();
    await s.spend(900000, s.me);
    await s.spend(300000, s.binh);
    const p = await s.st.markPaid(s.g.id, s.an, 400000);
    expect(p.direction).toBe("pay_to_me");
    expect((await s.bal(s.an)).balance).toBe(0);
    expect((await s.bal(s.me)).balance).toBe(100000);
    expect((await s.bal(s.binh)).balance).toBe(-100000);
    expect(await s.text()).toEqual(["Bình trả Tôi 100.000đ"]);
    const { rows } = await s.st.getGroupSummary(s.g.id);
    expect(rows.reduce((a, r) => a + r.balance, 0)).toBe(0);
  });

  it("AC2: pay_from_me, partial payments, errors, soft delete", async () => {
    const s = await setup();
    await s.spend(600000, s.binh);
    expect((await s.st.markPaid(s.g.id, s.binh, 100000)).direction).toBe("pay_from_me");
    expect((await s.bal(s.binh)).balance).toBe(300000);
    expect(await code(s.st.markPaid(s.g.id, s.binh, 300001))).toBe("invalid_amount");
    expect(await code(s.st.markPaid(s.g.id, s.binh, 1.5))).toBe("invalid_amount");
    expect(await code(s.st.markPaid(s.g.id, s.binh, 0))).toBe("invalid_amount");
    expect(await code(s.st.markPaid(s.g.id, s.me, 1000))).toBe("member_not_found");
    expect(await code(s.st.markPaid(s.g.id, "nope", 1000))).toBe("member_not_found");
    expect(await code(s.st.markPaid("nope", s.an, 1000))).toBe("not_found");
    await s.st.markPaid(s.g.id, s.binh, 300000);
    expect(await code(s.st.markPaid(s.g.id, s.binh, 1000))).toBe("nothing_to_settle");
    const row = s.db.select().from(settlementPayments).all()[0];
    s.db
      .update(settlementPayments)
      .set({ deleted_at: "2026-11-21T00:00:00Z" })
      .where(eq(settlementPayments.id, row.id))
      .run();
    expect((await s.bal(s.binh)).balance).toBe(row.amount);
  });

  it("AC3: payments never change personal totals or my share", async () => {
    const s = await setup();
    await s.spend(900000, s.me);
    await s.spend(300000, s.binh);
    const snap = async () => ({
      share: await s.exp.myShareByMonth("2026-11"),
      shares: await s.exp.mySharesInMonth("2026-11"),
      list: await s.tx.list(),
    });
    const before = await snap();
    await s.st.markPaid(s.g.id, s.an, 400000);
    expect(await snap()).toEqual(before);
  });

  it("AC4: group without expenses", async () => {
    const s = await setup();
    const { rows, items } = await s.st.getGroupSummary(s.g.id);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.paid === 0 && r.owed === 0 && r.balance === 0)).toBe(true);
    expect(items).toEqual([]);
    expect(await code(s.st.getGroupSummary("nope"))).toBe("not_found");
  });

  it("AC5: listMemberExpenses", async () => {
    const s = await setup();
    const a = await s.spend(300000, s.binh, [s.me, s.an], "2026-11-18T08:00:00Z");
    const b = await s.spend(300000, s.me, [s.me, s.binh], "2026-11-19T08:00:00Z");
    await s.spend(100000, s.me, [s.me, s.an], "2026-11-20T08:00:00Z");
    const gone = await s.spend(90000, s.me, [s.me, s.binh], "2026-11-21T08:00:00Z");
    await s.tx.softDelete(gone.id);
    const list = await s.st.listMemberExpenses(s.g.id, s.binh);
    expect(list.map((e) => [e.transaction.id, e.paidByMe, e.myShare])).toEqual([
      [b.id, false, 150000],
      [a.id, true, 0],
    ]);
  });
});
