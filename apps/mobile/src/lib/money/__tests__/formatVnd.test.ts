import { formatVnd } from "../formatVnd";

describe("formatVnd", () => {
  test.each([
    [1_200_000, "1.200.000đ"],
    [0, "0đ"],
    [999, "999đ"],
    [1000, "1.000đ"],
    [2_000_000_000, "2.000.000.000đ"],
    [-1500, "-1.500đ"],
  ])("%d -> %s", (n, out) => {
    expect(formatVnd(n)).toBe(out);
  });

  test("throws on non-integers", () => {
    expect(() => formatVnd(1.5)).toThrow(RangeError);
    expect(() => formatVnd(NaN)).toThrow(RangeError);
  });
});
