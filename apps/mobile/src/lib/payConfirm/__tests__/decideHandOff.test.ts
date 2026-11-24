import { PAY_APPS } from "../apps";
import { decideHandOff } from "../decideHandOff";

const app = (id: string) => PAY_APPS.find((a) => a.id === id)!;

describe("decideHandOff", () => {
  it("android + non-autofill app (no memory) → direct-share", () => {
    expect(decideHandOff(app("tcb"), "android")).toBe("direct-share");
    expect(decideHandOff(app("tcb"), "android", "share_ok")).toBe("direct-share");
  });
  it("android + share_failed memory → open-only", () => {
    expect(decideHandOff(app("tcb"), "android", "share_failed")).toBe("open-only");
  });
  it("autofill app → autofill-link on both platforms", () => {
    expect(decideHandOff(app("mb"), "android")).toBe("autofill-link");
    expect(decideHandOff(app("mb"), "ios")).toBe("autofill-link");
  });
  it("ios + non-autofill → open-only", () => {
    expect(decideHandOff(app("tcb"), "ios")).toBe("open-only");
  });
  it("android app without a package → open-only", () => {
    expect(decideHandOff({ ...app("tcb"), androidPackage: undefined }, "android")).toBe("open-only");
  });
});
