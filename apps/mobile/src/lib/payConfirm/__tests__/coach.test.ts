import { PAY_APPS } from "../apps";
import { COACH_KEY, createCoachStore, needsCoach } from "../coach";

const app = (id: string) => PAY_APPS.find((a) => a.id === id)!;

function memory() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async <T>(k: string) => (data.get(k) as T | undefined) ?? null,
    set: async (k: string, v: unknown) => {
      data.set(k, v);
    },
  };
}

describe("needsCoach", () => {
  it("AC1: a non-autofill bank not dismissed gets the sheet", () => {
    expect(needsCoach(app("tcb"), [])).toBe("sheet");
  });
  it("AC2: a dismissed bank gets the toast", () => {
    expect(needsCoach(app("tcb"), ["tcb"])).toBe("toast");
  });
  it("AC3: dismissing one bank does not affect another", () => {
    expect(needsCoach(app("vcb"), ["tcb"])).toBe("sheet");
  });
  it("AC4: autofill apps never get a hint", () => {
    const autofill = PAY_APPS.filter((a) => a.supportsAutofill);
    expect(autofill.length).toBeGreaterThan(0);
    for (const a of autofill) expect(needsCoach(a, [])).toBe("none");
    expect(needsCoach(app("mb"), ["mb"])).toBe("none");
  });
  it("normalises legacy ids", () => {
    expect(needsCoach(app("tpb"), ["tpbank"])).toBe("toast");
  });
});

describe("createCoachStore", () => {
  it("persists a dismissal once, per bank", async () => {
    const m = memory();
    const store = createCoachStore(m);
    expect(await store.list()).toEqual([]);
    await store.dismiss("tcb");
    await store.dismiss("tcb");
    await store.dismiss("tpbank");
    expect(m.data.get(COACH_KEY)).toEqual(["tcb", "tpb"]);
    expect(await store.list()).toEqual(["tcb", "tpb"]);
  });
  it("ignores a corrupt value", async () => {
    const m = memory();
    m.data.set(COACH_KEY, "oops");
    expect(await createCoachStore(m).list()).toEqual([]);
  });
});
