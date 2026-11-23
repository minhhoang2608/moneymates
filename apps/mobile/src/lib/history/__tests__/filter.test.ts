import { defaultFilters, emptyFilters, isFiltered, monthBounds, recentMonths, toTransactionFilter } from "../filter";

describe("history filters", () => {
  it("month bounds are the UTC instants of VN month starts", () => {
    expect(monthBounds("2026-11")).toEqual({ from: "2026-10-31T17:00:00.000Z", to: "2026-11-30T17:00:00.000Z" });
    expect(monthBounds("2026-12")).toEqual({ from: "2026-11-30T17:00:00.000Z", to: "2026-12-31T17:00:00.000Z" });
  });

  it("maps filters to a repository filter and skips empty ones", () => {
    expect(toTransactionFilter(emptyFilters)).toEqual({});
    expect(
      toTransactionFilter({ month: "2026-11", categoryId: "c", moneySource: "Thẻ", type: "expense", search: "phở" }),
    ).toEqual({
      from: "2026-10-31T17:00:00.000Z",
      to: "2026-11-30T17:00:00.000Z",
      categoryId: "c",
      moneySource: "Thẻ",
      type: "expense",
      search: "phở",
    });
  });

  it("defaults to the current VN month and detects active filters", () => {
    const f = defaultFilters(new Date("2026-11-30T20:00:00Z")); // already Dec 1 in VN
    expect(f.month).toBe("2026-12");
    expect(isFiltered(f)).toBe(true);
    expect(isFiltered(emptyFilters)).toBe(false);
    expect(isFiltered({ ...emptyFilters, search: "  " })).toBe(false);
  });

  it("lists the last 12 months across a year boundary", () => {
    const m = recentMonths(new Date("2026-02-10T00:00:00Z"));
    expect(m).toHaveLength(12);
    expect(m.slice(0, 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(m[11]).toBe("2025-03");
  });
});
