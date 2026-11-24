import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { setCurrentPath } from "@/lib/receipt/currentPath";

import { redirectSystemPath } from "../+native-intent";

const SHARE_URL = "moneymates://dataUrl=moneymatesShareKey";

describe("redirectSystemPath", () => {
  afterEach(() => setCurrentPath(null));

  it("falls back to / for a share url on cold start (no route known)", () => {
    expect(redirectSystemPath({ path: SHARE_URL, initial: true })).toBe("/");
  });
  it("keeps the current screen for a warm-start share url", () => {
    setCurrentPath("/group/42");
    expect(redirectSystemPath({ path: SHARE_URL, initial: false })).toBe("/group/42");
  });
  it("passes other paths through", () => {
    setCurrentPath("/group/42");
    expect(redirectSystemPath({ path: "/group/1", initial: false })).toBe("/group/1");
  });
  it("only the root layout records the path", () => {
    const layout = readFileSync(resolve(__dirname, "../_layout.tsx"), "utf8");
    expect(layout).toMatch(/usePathname\(\)/);
    expect(layout).toMatch(/setCurrentPath\(pathname\)/);
  });
});
