import { evaluateSplitDraft, parsePercentBp, type SplitDraftInput } from "../splitDraft";

const M = ["me", "an", "binh"];
const base = (o: Partial<SplitDraftInput>): SplitDraftInput => ({
  amount: 1_000_000,
  mode: "equal",
  members: M,
  ticked: new Set(M),
  amountInputs: {},
  percentInputs: {},
  ...o,
});
const amounts = (d: ReturnType<typeof evaluateSplitDraft>) => d.preview.map((p) => p.amount);

describe("evaluateSplitDraft", () => {
  it("AC1 equal 3 ways puts the remainder on the first", () => {
    const d = evaluateSplitDraft(base({}));
    expect(d.ok).toBe(true);
    expect(amounts(d)).toEqual([333_334, 333_333, 333_333]);
  });

  it("AC2 unticked members are excluded; none ticked → noMembers", () => {
    const d = evaluateSplitDraft(base({ amount: 300_000, ticked: new Set(["me", "an"]) }));
    expect(amounts(d)).toEqual([150_000, 150_000]);
    expect(evaluateSplitDraft(base({ ticked: new Set() })).status).toEqual({ kind: "noMembers" });
  });

  it.each([
    ["200k", "250k", { kind: "short", diff: 50_000 }, false],
    ["200k", "350k", { kind: "over", diff: 50_000 }, false],
    ["200k", "300k", { kind: "ok" }, true],
  ])("AC3 by amount %s + %s", (a, b, status, ok) => {
    const d = evaluateSplitDraft(
      base({ amount: 500_000, mode: "amount", ticked: new Set(["me", "an"]), amountInputs: { me: a, an: b } }),
    );
    expect(d.status).toEqual(status);
    expect(d.ok).toBe(ok);
  });

  it("AC4 by percent", () => {
    const pct = (a: string, b: string, c: string) =>
      evaluateSplitDraft(base({ amount: 100_000, mode: "percent", percentInputs: { me: a, an: b, binh: c } }));
    expect(amounts(pct("50", "30", "20"))).toEqual([50_000, 30_000, 20_000]);
    expect(pct("50", "30", "10").status).toEqual({ kind: "percentNot100", diffBp: 1000, over: false });
    expect(pct("50", "abc", "20").status).toEqual({ kind: "invalidValue" });
  });

  it("invalid amount is invalid", () => {
    expect(evaluateSplitDraft(base({ amount: null })).ok).toBe(false);
  });

  it("every ok result sums exactly to the amount", () => {
    for (const amount of [1, 7, 100, 999_999, 1_000_001]) {
      const d = evaluateSplitDraft(base({ amount }));
      expect(d.preview.reduce((s, p) => s + p.amount, 0)).toBe(amount);
    }
    const p = evaluateSplitDraft(
      base({ amount: 100_001, mode: "percent", percentInputs: { me: "33,33", an: "33,33", binh: "33,34" } }),
    );
    expect(p.ok).toBe(true);
    expect(p.preview.reduce((s, x) => s + x.amount, 0)).toBe(100_001);
  });
});

describe("parsePercentBp", () => {
  it.each([
    ["50", 5000],
    ["33,5", 3350],
    ["33.33", 3333],
    ["100", 10000],
    ["0", 0],
  ])("%s → %s", (t, bp) => expect(parsePercentBp(t)).toBe(bp));
  it.each(["", "abc", "101", "1.234", "-5", "100,01"])("rejects %j", (t) => expect(parsePercentBp(t)).toBeNull());
});
