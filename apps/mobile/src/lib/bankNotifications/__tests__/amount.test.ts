import { parseSignedVnd } from "../amount";

describe("parseSignedVnd", () => {
  it.each([
    ["55,000", null, 55000],
    ["55.000", null, 55000],
    ["-55,000", "-", 55000],
    ["+1.250.000", "+", 1250000],
    ["1,250,000", null, 1250000],
    ["55.000đ", null, 55000],
    ["55,000 VND", null, 55000],
    ["-50000", "-", 50000],
  ])("%s", (raw, sign, vnd) => {
    const r = parseSignedVnd(raw);
    expect(r).toEqual({ sign, vnd });
    expect(Number.isInteger(r?.vnd)).toBe(true);
  });

  it.each(["1.250,000", "55,000.50", "12,34", "abc", ""])("rejects %s", (raw) => {
    expect(parseSignedVnd(raw)).toBeNull();
  });
});
