import { splitByAmount, splitByPercent, splitEqual, type SplitResult } from "../index";

const amounts = (r: SplitResult) => {
  if (!r.ok) throw new Error("expected ok");
  return r.shares.map((s) => s.amount);
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("splitEqual", () => {
  it("gives the remainder to the first member", () => {
    expect(amounts(splitEqual(1_000_000, ["Tôi", "An", "Bình"]))).toEqual([333334, 333333, 333333]);
  });
  it("only splits among given members", () => {
    const r = splitEqual(300_000, ["Tôi", "An"]);
    expect(amounts(r)).toEqual([150_000, 150_000]);
    if (r.ok) expect(r.shares.map((s) => s.memberId)).toEqual(["Tôi", "An"]);
  });
  it("sums exactly", () => {
    for (const a of [0, 1, 2, 99_999, 1_000_001]) {
      for (let n = 1; n <= 7; n++) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`);
        const xs = amounts(splitEqual(a, ids));
        expect(sum(xs)).toBe(a);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
      }
    }
  });
  it("zero amount gives zeros", () => {
    expect(amounts(splitEqual(0, ["a", "b"]))).toEqual([0, 0]);
  });
  it("throws on bad input", () => {
    expect(() => splitEqual(1.5, ["a"])).toThrow();
    expect(() => splitEqual(-1, ["a"])).toThrow();
    expect(() => splitEqual(Number.MAX_SAFE_INTEGER + 1, ["a"])).toThrow();
    expect(() => splitEqual(10, [])).toThrow();
    expect(() => splitEqual(10, ["a", "a"])).toThrow();
  });
});

describe("splitByAmount", () => {
  const p = (a: number, b: number) => [
    { memberId: "Tôi", amount: a },
    { memberId: "An", amount: b },
  ];
  it("short", () => {
    expect(splitByAmount(500_000, p(200_000, 250_000))).toEqual({ ok: false, reason: "short", diff: 50_000 });
  });
  it("over", () => {
    expect(splitByAmount(500_000, p(200_000, 350_000))).toEqual({ ok: false, reason: "over", diff: 50_000 });
  });
  it("ok", () => {
    expect(amounts(splitByAmount(500_000, p(200_000, 300_000)))).toEqual([200_000, 300_000]);
  });
  it("throws on negative part", () => {
    expect(() => splitByAmount(10, p(-1, 11))).toThrow();
  });
});

describe("splitByPercent", () => {
  const mk = (...bps: number[]) => bps.map((bp, i) => ({ memberId: `m${i}`, bp }));
  it("exact percentages", () => {
    expect(amounts(splitByPercent(100_000, mk(5000, 3000, 2000)))).toEqual([50_000, 30_000, 20_000]);
  });
  it("not 100%", () => {
    expect(splitByPercent(100_000, mk(5000, 4000))).toEqual({ ok: false, reason: "percentNot100", diffBp: 1000 });
    expect(splitByPercent(100_000, mk(6000, 5000))).toEqual({ ok: false, reason: "percentNot100", diffBp: 1000 });
  });
  it("thirds", () => {
    expect(amounts(splitByPercent(100_000, mk(3334, 3333, 3333)))).toEqual([33_340, 33_330, 33_330]);
    const x = amounts(splitByPercent(100_001, mk(3334, 3333, 3333)));
    expect(sum(x)).toBe(100_001);
    expect(x).toEqual([33_341, 33_330, 33_330]);
  });
  it("largest remainder with tie order", () => {
    // 10 * 3333/10000 = 3.333, 3.333, 3.334 -> floors 3,3,3, leftover 1 to the largest frac (last)
    expect(amounts(splitByPercent(10, mk(3333, 3333, 3334)))).toEqual([3, 3, 4]);
    // exact tie: 1đ over 2 members at 50/50 -> first wins
    expect(amounts(splitByPercent(1, mk(5000, 5000)))).toEqual([1, 0]);
  });
  it("sums exactly for pseudo-random bp sets", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rnd() * 6);
      const cuts = Array.from({ length: n - 1 }, () => Math.floor(rnd() * 10001)).sort((a, b) => a - b);
      const bps = [...cuts, 10000].map((c, i) => c - (i === 0 ? 0 : [...cuts, 10000][i - 1]));
      const amount = Math.floor(rnd() * 5_000_000);
      expect(sum(amounts(splitByPercent(amount, mk(...bps))))).toBe(amount);
    }
  });
  it("handles very large amounts without precision loss", () => {
    const a = 2_000_000_000;
    expect(amounts(splitByPercent(a, mk(3334, 3333, 3333)))).toEqual([666_800_000, 666_600_000, 666_600_000]);
    const big = Number.MAX_SAFE_INTEGER;
    expect(sum(amounts(splitByPercent(big, mk(3333, 3333, 3334))))).toBe(big);
  });
});
