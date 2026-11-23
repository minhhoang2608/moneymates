import { shiftMonthKey } from "../monthKey";
import { monthlyTrend } from "../trend";

const e = (amount: number, occurredAt: string) => ({ type: "expense" as const, amount, occurredAt });

describe("shiftMonthKey", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonthKey("2027-02", -5)).toBe("2026-09");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-11", 0)).toBe("2026-11");
  });
});

describe("monthlyTrend", () => {
  it("AC4: 6 months oldest first, empty month is 0, includes my shares", () => {
    const r = monthlyTrend({
      txns: [e(100, "2026-06-05T03:00:00Z"), e(200, "2026-07-05T03:00:00Z"), e(400, "2026-11-05T03:00:00Z")],
      myShares: [{ amount: 50, occurredAt: "2026-10-05T03:00:00Z" }],
      endMonth: "2026-11",
    });
    expect(r.map((p) => p.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(r.map((p) => p.total)).toEqual([100, 200, 0, 0, 50, 400]);
  });

  it("AC4: year boundary", () => {
    const r = monthlyTrend({ txns: [], myShares: [], endMonth: "2027-02" });
    expect(r.map((p) => p.month)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});
