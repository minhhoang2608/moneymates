import { parseAmount } from "../parseAmount";

const accepted: [string, number][] = [
  ["1tr2", 1_200_000],
  ["1.5tr", 1_500_000],
  ["1,5tr", 1_500_000],
  ["50.000", 50_000],
  ["50,000", 50_000],
  ["50000", 50_000],
  ["50k", 50_000],
  ["50 K", 50_000],
  ["  50k  ", 50_000],
  ["1 trieu", 1_000_000],
  ["1 triệu", 1_000_000],
  ["50 nghin", 50_000],
  ["200 ngàn", 200_000],
  ["1 củ", 1_000_000],
  ["1k5", 1_500],
  ["1tr25", 1_250_000],
  ["1tr250", 1_250_000],
  ["2 tỷ", 2_000_000_000],
  ["2tỷ5", 2_500_000_000],
  ["1.250.000", 1_250_000],
];

const rejected = [
  "",
  "   ",
  "0",
  "0k",
  "abc",
  "50.00",
  "1.5.0",
  "50,000.5",
  "1tr2345",
  "1.5tr2",
  "-50k",
  "k",
  "1e3",
  "1.250,000",
  "1.5k5",
  "50 xyz",
];

describe("parseAmount", () => {
  test.each(accepted)("%j -> %d", (text, vnd) => {
    expect(parseAmount(text)).toEqual({ ok: true, vnd });
  });

  test.each(rejected)("rejects %j", (text) => {
    expect(parseAmount(text)).toEqual({ ok: false });
  });

  test("accepted results are positive integers", () => {
    for (const [text] of accepted) {
      const r = parseAmount(text);
      expect(r.ok && Number.isInteger(r.vnd) && r.vnd > 0).toBe(true);
    }
  });

  test("rejects unsafe magnitudes", () => {
    expect(parseAmount("99999999999999999999")).toEqual({ ok: false });
  });
});
