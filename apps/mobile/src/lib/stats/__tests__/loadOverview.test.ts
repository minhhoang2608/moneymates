import {
  createCategoryRepository,
  createGroupExpenseRepository,
  createGroupRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { Repositories } from "@/db/RepositoriesProvider";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

import { loadOverview } from "../loadOverview";

const NOW = new Date("2026-11-22T05:00:00Z");

function setup() {
  const { db } = openTestDb();
  const transactions = createTransactionRepository(db as unknown as AnyDb);
  const categories = createCategoryRepository(db as unknown as AnyDb);
  const repos = { transactions, categories } as unknown as Pick<Repositories, "transactions" | "categories">;
  const add = (amount: number, occurred_at: string, type: "expense" | "income" = "expense") =>
    transactions.create({
      type,
      amount,
      occurred_at,
      note: "",
      category_id: catId(type === "expense" ? "Ăn uống" : "Lương", type),
    });
  return { repos, add, transactions };
}

describe("loadOverview", () => {
  it("AC1: totals for the current month through the DB", async () => {
    const { repos, add } = setup();
    await add(50_000, "2026-11-05T03:00:00Z");
    await add(150_000, "2026-11-06T03:00:00Z");
    await add(25_000_000, "2026-11-01T03:00:00Z", "income");
    const d = await loadOverview(repos, { now: NOW });
    expect(d.overview.expenseTotal).toBe(200_000);
    expect(d.overview.incomeTotal).toBe(25_000_000);
  });

  it("month boundaries: local 00:00 on the 1st belongs to the new month", async () => {
    const { repos, add } = setup();
    await add(10_000, "2026-10-31T17:00:00Z"); // 01/11 00:00 VN
    await add(20_000, "2026-10-31T16:59:59Z"); // 31/10 23:59:59 VN
    const d = await loadOverview(repos, { now: NOW });
    expect(d.overview.expenseTotal).toBe(10_000);
    expect(d.overview.lastExpenseTotal).toBe(20_000);
  });

  it("excludes soft-deleted rows", async () => {
    const { repos, add, transactions } = setup();
    const row = await add(70_000, "2026-11-05T03:00:00Z");
    await add(30_000, "2026-11-06T03:00:00Z");
    await transactions.softDelete(row.id);
    const d = await loadOverview(repos, { now: NOW });
    expect(d.overview.expenseTotal).toBe(30_000);
  });

  it("AC3: 7 transactions give the 5 most recent in order; default my share is empty", async () => {
    const { repos, add } = setup();
    for (let i = 1; i <= 7; i++) await add(i * 1000, `2026-11-0${i}T03:00:00Z`);
    const d = await loadOverview(repos, { now: NOW });
    expect(d.recent.map((r) => r.amount)).toEqual([7000, 6000, 5000, 4000, 3000]);
    expect(d.overview.myShareTotal).toBe(0);
  });
});

describe("loadOverview with group shares", () => {
  async function groupSetup(payerIsMe: boolean) {
    const { db } = openTestDb();
    const a = db as unknown as AnyDb;
    const transactions = createTransactionRepository(a);
    const categories = createCategoryRepository(a);
    const groups = createGroupRepository(a);
    const groupExpenses = createGroupExpenseRepository(a);
    const g = await groups.createGroup({ name: "Đà Lạt", members: ["An", "Bình", "Chi"] });
    const ids = g.members.map((m) => m.id);
    const t = await groupExpenses.createGroupExpense({
      groupId: g.id,
      amount: 1_000_000,
      payerMemberId: payerIsMe ? ids[0] : ids[1],
      splitMode: "equal",
      shares: ids.map((memberId) => ({ memberId })),
      occurredAt: "2026-11-10T03:00:00Z",
    });
    const repos = { transactions, categories } as unknown as Pick<Repositories, "transactions" | "categories">;
    return { repos, transactions, groupExpenses, t };
  }

  it.each([true, false])("AC3/AC4: my share (payer is me: %s) counts, deleting drops it", async (payerIsMe) => {
    const { repos, transactions, groupExpenses, t } = await groupSetup(payerIsMe);
    const opts = { now: NOW, myShares: groupExpenses.mySharesInMonth };
    const d = await loadOverview(repos, opts);
    expect(d.overview.expenseTotal).toBe(250_000);
    expect(d.overview.myShareTotal).toBe(250_000);
    await transactions.softDelete(t.id);
    const after = await loadOverview(repos, opts);
    expect(after.overview.expenseTotal).toBe(0);
  });
});
