import { monthKeyOf } from "../monthKey";

describe("monthKeyOf (UTC+7)", () => {
  test.each([
    ["2026-10-31T16:59:59Z", "2026-10"],
    ["2026-10-31T17:00:00Z", "2026-11"],
    ["2026-12-31T17:00:00Z", "2027-01"],
    ["2026-11-15T00:00:00Z", "2026-11"],
  ])("%s -> %s", (iso, key) => expect(monthKeyOf(iso)).toBe(key));

  test("throws on invalid date", () => expect(() => monthKeyOf("nope")).toThrow());
});
