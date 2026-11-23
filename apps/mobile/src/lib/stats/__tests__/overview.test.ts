import { buildOverview, changePercent, prevMonthKey, type OverviewTxn } from "../overview";

const names = { a: "Ăn uống", b: "Di chuyển", c: "Mua sắm", inc: "Lương" };
const t = (
  amount: number,
  categoryId: string,
  occurredAt: string,
  type: "expense" | "income" = "expense",
  groupId?: string,
): OverviewTxn => ({
  type,
  amount,
  categoryId,
  occurredAt,
  groupId,
});
const build = (
  txns: OverviewTxn[],
  lastTxns: OverviewTxn[] = [],
  myShares: { amount: number; occurredAt: string }[] = [],
) => buildOverview({ txns, lastTxns, myShares, lastMyShares: [], categoryNames: names, month: "2026-11" });

describe("prevMonthKey", () => {
  test.each([
    ["2026-01", "2025-12"],
    ["2026-11", "2026-10"],
  ])("%s -> %s", (m, out) => expect(prevMonthKey(m)).toBe(out));
});

describe("changePercent", () => {
  test.each([
    [12_500_000, 10_000_000, 25],
    [7_500_000, 10_000_000, 25],
    [1, 3, 67],
    [5, 0, 0],
  ])("%d vs %d -> %d", (a, b, out) => expect(changePercent(a, b)).toBe(out));
});

describe("buildOverview", () => {
  it("AC1: sums expenses and income, ignores group rows, adds my share", () => {
    const o = build(
      [
        t(50_000, "a", "2026-11-05T03:00:00Z"),
        t(150_000, "b", "2026-11-06T03:00:00Z"),
        t(25_000_000, "inc", "2026-11-01T03:00:00Z", "income"),
        t(999_000, "a", "2026-11-07T03:00:00Z", "expense", "g1"),
      ],
      [],
      [{ amount: 100_000, occurredAt: "2026-11-07T03:00:00Z" }],
    );
    expect(o.expenseTotal).toBe(300_000);
    expect(o.incomeTotal).toBe(25_000_000);
    expect(o.myShareTotal).toBe(100_000);
  });

  it("AC2: alert up at 25%, none at 10% or when last month is 0", () => {
    const last = [t(10_000_000, "a", "2026-10-05T03:00:00Z")];
    const up = build([t(12_500_000, "a", "2026-11-05T03:00:00Z")], last);
    expect(up.alert).toBe("up");
    expect(up.percent).toBe(25);
    expect(build([t(11_000_000, "a", "2026-11-05T03:00:00Z")], last).alert).toBe("none");
    expect(build([t(500_000, "a", "2026-11-05T03:00:00Z")]).alert).toBe("none");
  });

  it("AC4: top categories ordered by amount, income excluded", () => {
    const o = build([
      t(300_000, "c", "2026-11-02T03:00:00Z"),
      t(500_000, "a", "2026-11-03T03:00:00Z"),
      t(400_000, "b", "2026-11-04T03:00:00Z"),
      t(9_000_000, "inc", "2026-11-04T03:00:00Z", "income"),
    ]);
    expect(o.top).toEqual([
      { category: "Ăn uống", amount: 500_000 },
      { category: "Di chuyển", amount: 400_000 },
      { category: "Mua sắm", amount: 300_000 },
    ]);
  });
});
