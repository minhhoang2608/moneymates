import {
  createCategoryRepository,
  createGroupExpenseRepository,
  createGroupRepository,
  createProfileRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { Repositories } from "@/db/RepositoriesProvider";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

import { loadCategoryBreakdown, loadMonthlyTrend } from "../loadStats";

const food = catId("Ăn uống", "expense");

async function setup() {
  const { db } = openTestDb();
  const d = db as unknown as AnyDb;
  const transactions = createTransactionRepository(d);
  const groupExpenses = createGroupExpenseRepository(d);
  const categories = createCategoryRepository(d);
  await createProfileRepository(d).setDisplayName("Hoàng");
  const g = await createGroupRepository(d).createGroup({ name: "Đà Lạt", members: ["An", "Bình", "Chi"] });
  const ids = g.members.map((m) => m.id);
  const repos = { transactions, groupExpenses, categories } as unknown as Pick<
    Repositories,
    "transactions" | "categories" | "groupExpenses"
  >;
  const add = (amount: number, occurred_at: string, type: "expense" | "income" = "expense") =>
    transactions.create({
      type,
      amount,
      occurred_at,
      note: "",
      category_id: type === "expense" ? food : catId("Lương", "income"),
    });
  const group = (amount: number, occurredAt: string) =>
    groupExpenses.createGroupExpense({
      groupId: g.id,
      amount,
      payerMemberId: ids[0],
      splitMode: "equal",
      shares: ids.concat().map((memberId) => ({ memberId })),
      occurredAt,
      categoryId: food,
    });
  return { repos, add, group, transactions, groupExpenses };
}

describe("loadStats", () => {
  it("AC1/AC2: breakdown includes my equal share of a group expense", async () => {
    const s = await setup();
    await s.add(300_000, "2026-11-05T03:00:00Z");
    await s.group(1_000_000, "2026-11-20T08:00:00Z");
    const r = await loadCategoryBreakdown(s.repos, "2026-11", "expense");
    expect(r.total).toBe(550_000);
    expect(r.groupShareTotal).toBe(250_000);
    expect(r.items).toEqual([{ categoryId: food, category: "Ăn uống", amount: 550_000 }]);
  });

  it("AC5: soft-deleted rows excluded, other months excluded", async () => {
    const s = await setup();
    const a = await s.add(100_000, "2026-11-05T03:00:00Z");
    await s.transactions.softDelete(a.id);
    const ge = await s.group(1_000_000, "2026-11-20T08:00:00Z");
    await s.transactions.softDelete(ge.id);
    await s.add(70_000, "2026-10-05T03:00:00Z");
    expect((await loadCategoryBreakdown(s.repos, "2026-11", "expense")).total).toBe(0);
    expect((await loadCategoryBreakdown(s.repos, "2026-10", "expense")).total).toBe(70_000);
  });

  it("income breakdown ignores group shares", async () => {
    const s = await setup();
    await s.add(25_000_000, "2026-11-01T03:00:00Z", "income");
    await s.group(1_000_000, "2026-11-20T08:00:00Z");
    const r = await loadCategoryBreakdown(s.repos, "2026-11", "income");
    expect(r.total).toBe(25_000_000);
    expect(r.items.map((i) => i.category)).toEqual(["Lương"]);
  });

  it("AC4: trend over the DB with group share in its month", async () => {
    const s = await setup();
    await s.add(100_000, "2026-06-05T03:00:00Z");
    await s.group(1_000_000, "2026-10-20T08:00:00Z");
    await s.add(40_000, "2026-11-05T03:00:00Z");
    await s.add(999, "2026-05-31T03:00:00Z"); // out of window
    const r = await loadMonthlyTrend(s.repos, "2026-11");
    expect(r.map((p) => p.total)).toEqual([100_000, 0, 0, 0, 250_000, 40_000]);
  });

  it("AC6: empty DB", async () => {
    const s = await setup();
    expect(await loadCategoryBreakdown(s.repos, "2026-11", "expense")).toEqual({
      total: 0,
      groupShareTotal: 0,
      items: [],
    });
    expect((await loadMonthlyTrend(s.repos, "2026-11")).every((p) => p.total === 0)).toBe(true);
  });
});
