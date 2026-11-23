import fs from "fs";
import path from "path";

import { categoryBreakdown } from "../breakdown";

const names = { food: "Ăn uống", move: "Di chuyển", salary: "Lương" };
const exp = (amount: number, categoryId: string | null, occurredAt = "2026-11-05T03:00:00Z") => ({
  type: "expense" as const,
  amount,
  occurredAt,
  categoryId,
});

describe("categoryBreakdown", () => {
  it("AC1: sorted by amount desc", () => {
    const r = categoryBreakdown({
      txns: [exp(200_000, "move"), exp(300_000, "food")],
      myShares: [],
      month: "2026-11",
      kind: "expense",
      categoryNames: names,
    });
    expect(r.total).toBe(500_000);
    expect(r.items.map((i) => i.category)).toEqual(["Ăn uống", "Di chuyển"]);
  });

  it("AC2: adds my group share by category", () => {
    const r = categoryBreakdown({
      txns: [exp(300_000, "food"), exp(200_000, "move")],
      myShares: [{ amount: 250_000, occurredAt: "2026-11-20T08:00:00Z", categoryId: "food" }],
      month: "2026-11",
      kind: "expense",
      categoryNames: names,
    });
    expect(r.items[0]).toMatchObject({ category: "Ăn uống", amount: 550_000 });
    expect(r.total).toBe(750_000);
    expect(r.groupShareTotal).toBe(250_000);
  });

  it("AC3: income ignores shares", () => {
    const r = categoryBreakdown({
      txns: [{ type: "income", amount: 25_000_000, occurredAt: "2026-11-01T03:00:00Z", categoryId: "salary" }],
      myShares: [{ amount: 1, occurredAt: "2026-11-20T08:00:00Z", categoryId: "food" }],
      month: "2026-11",
      kind: "income",
      categoryNames: names,
    });
    expect(r.items).toEqual([{ categoryId: "salary", category: "Lương", amount: 25_000_000 }]);
    expect(r.groupShareTotal).toBe(0);
  });

  it("AC5: VN month boundary, group rows skipped, integer check", () => {
    const base = {
      myShares: [],
      month: "2026-10",
      kind: "expense" as const,
      categoryNames: names,
    };
    const r = categoryBreakdown({
      ...base,
      txns: [exp(1000, "food", "2026-10-31T16:00:00Z"), exp(5000, "food", "2026-10-31T17:00:00Z")],
    });
    expect(r.total).toBe(1000);
    const g = categoryBreakdown({ ...base, txns: [{ ...exp(1000, "food", "2026-10-05T03:00:00Z"), groupId: "g" }] });
    expect(g.total).toBe(0);
    expect(() => categoryBreakdown({ ...base, txns: [exp(1.5, "food", "2026-10-05T03:00:00Z")] })).toThrow();
  });

  it("AC6: empty month; unknown or null category is Khác", () => {
    const empty = categoryBreakdown({
      txns: [],
      myShares: [],
      month: "2026-11",
      kind: "expense",
      categoryNames: names,
    });
    expect(empty).toEqual({ total: 0, groupShareTotal: 0, items: [] });
    const r = categoryBreakdown({
      txns: [exp(10, null), exp(20, "gone")],
      myShares: [],
      month: "2026-11",
      kind: "expense",
      categoryNames: names,
    });
    expect(r.items).toEqual([{ categoryId: null, category: "Khác", amount: 30 }]);
  });

  it("golden: totals match the monthly-total fixture", () => {
    const g = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../../../../../tests/golden/stats/monthly-total-with-group-share.json"),
        "utf8",
      ),
    );
    const txns = g.input.personal.map((p: any) => ({
      type: p.type,
      amount: p.amount,
      occurredAt: p.occurred_at,
      categoryId: null,
    }));
    const myShares = g.input.group_expenses.map((e: any) => ({
      amount: e.my_share,
      occurredAt: e.occurred_at,
      categoryId: null,
    }));
    const run = (kind: "expense" | "income") =>
      categoryBreakdown({ txns, myShares, month: g.input.month, kind, categoryNames: {} });
    const e = run("expense");
    expect(e.total).toBe(g.expected.expense_total);
    expect(e.items.reduce((s, i) => s + i.amount, 0)).toBe(e.total);
    expect(run("income").total).toBe(g.expected.income_total);
  });
});
