import { dayKeyOf, dayLabel, groupByDay, timeOf } from "../groupByDay";

const today = new Date("2026-11-22T05:00:00Z"); // 12:00 VN, Sunday

const row = (occurred_at: string, type: "expense" | "income", amount: number) => ({ occurred_at, type, amount });

describe("groupByDay", () => {
  it("groups by VN day, newest first, with totals", () => {
    const groups = groupByDay(
      [
        row("2026-11-22T03:00:00Z", "expense", 55_000),
        row("2026-11-22T02:00:00Z", "expense", 45_000),
        row("2026-11-21T16:30:00Z", "income", 25_000_000), // 23:30 VN on the 21st
        row("2026-11-20T05:00:00Z", "expense", 10_000),
      ],
      today,
    );
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-11-22", "2026-11-21", "2026-11-20"]);
    expect(groups.map((g) => g.label)).toEqual(["Hôm nay, 22/11", "Hôm qua, 21/11", "Thứ 6, 20/11"]);
    expect(groups[0]).toMatchObject({ expenseTotal: 100_000, incomeTotal: 0 });
    expect(groups[1]).toMatchObject({ expenseTotal: 0, incomeTotal: 25_000_000 });
  });

  it("uses the VN day at the UTC midnight edge", () => {
    expect(dayKeyOf("2026-11-21T17:00:00Z")).toBe("2026-11-22");
    expect(dayKeyOf("2026-11-21T16:59:59Z")).toBe("2026-11-21");
    expect(timeOf("2026-11-21T16:30:00Z")).toBe("23:30");
  });

  it("labels Sunday as Chủ nhật and Saturday as Thứ 7", () => {
    expect(dayLabel("2026-11-15", today)).toBe("Chủ nhật, 15/11");
    expect(dayLabel("2026-11-14", today)).toBe("Thứ 7, 14/11");
  });

  it("returns [] for no rows", () => {
    expect(groupByDay([], today)).toEqual([]);
  });
});
