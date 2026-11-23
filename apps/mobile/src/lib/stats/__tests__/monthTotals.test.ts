import { monthTotals } from "../monthTotals";

const at = "2026-11-10T05:00:00Z";

describe("monthTotals", () => {
  test("sums personal expenses and income", () => {
    expect(
      monthTotals(
        [
          { type: "expense", amount: 50_000, occurredAt: at },
          { type: "expense", amount: 150_000, occurredAt: at },
          { type: "income", amount: 25_000_000, occurredAt: at },
        ],
        [],
        "2026-11",
      ),
    ).toEqual({ expenseTotal: 200_000, incomeTotal: 25_000_000 });
  });

  test("empty input", () => {
    expect(monthTotals([], [], "2026-11")).toEqual({ expenseTotal: 0, incomeTotal: 0 });
  });

  test("my share counts only in its own month", () => {
    const shares = [{ amount: 250_000, occurredAt: "2026-11-20T08:00:00Z" }];
    expect(monthTotals([], shares, "2026-11").expenseTotal).toBe(250_000);
    expect(monthTotals([], shares, "2026-10").expenseTotal).toBe(0);
    expect(monthTotals([], shares, "2026-12").expenseTotal).toBe(0);
  });

  test("group rows are not double-counted", () => {
    const r = monthTotals([{ type: "expense", amount: 1_000_000, occurredAt: at, groupId: "g1" }], [], "2026-11");
    expect(r.expenseTotal).toBe(0);
  });

  test("other months are excluded", () => {
    const r = monthTotals([{ type: "expense", amount: 5, occurredAt: "2026-10-31T16:00:00Z" }], [], "2026-11");
    expect(r.expenseTotal).toBe(0);
  });

  test("throws on non-integer amount", () => {
    expect(() => monthTotals([{ type: "expense", amount: 1.5, occurredAt: at }], [], "2026-11")).toThrow();
  });
});
