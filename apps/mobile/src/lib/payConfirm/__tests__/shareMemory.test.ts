import { PAY_APPS } from "../apps";
import { decideHandOff } from "../decideHandOff";
import { knownResultFor, recordShareResult, type ShareMemory } from "../shareMemory";

const app = (id: string) => PAY_APPS.find((a) => a.id === id)!;

describe("shareMemory", () => {
  it("unknown is absent and decides direct-share", () => {
    expect(knownResultFor({}, "tcb")).toBeUndefined();
    expect(decideHandOff(app("tcb"), "android", knownResultFor({}, "tcb"))).toBe("direct-share");
  });

  it("a remembered failure no longer switches direct-share off; success is still remembered", () => {
    const failed = recordShareResult({}, "tcb", false);
    expect(decideHandOff(app("tcb"), "android", knownResultFor(failed, "tcb"))).toBe("direct-share");
    const ok = recordShareResult(failed, "tcb", true);
    expect(knownResultFor(ok, "tcb")).toBe("share_ok");
    expect(decideHandOff(app("tcb"), "android", knownResultFor(ok, "tcb"))).toBe("direct-share");
  });

  it("is remembered per bank and does not mutate the input", () => {
    const mem: ShareMemory = {};
    const next = recordShareResult(mem, "tcb", false);
    expect(mem).toEqual({});
    expect(knownResultFor(next, "vcb")).toBeUndefined();
    expect(decideHandOff(app("vcb"), "android", knownResultFor(next, "vcb"))).toBe("direct-share");
  });
});
