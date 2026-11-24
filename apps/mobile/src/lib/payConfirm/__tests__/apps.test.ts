import { readFileSync } from "fs";
import { join } from "path";
import { PAY_APPS, defaultAppId, orderAppsBySaved } from "../apps";

describe("orderAppsBySaved", () => {
  it("keeps catalogue order without a saved order", () => {
    expect(orderAppsBySaved(PAY_APPS, []).map((a) => a.id)).toEqual(PAY_APPS.map((a) => a.id));
  });
  it("puts MoMo first, drops unknown keys and appends missing apps", () => {
    const ids = orderAppsBySaved(PAY_APPS, ["momo", "ghost", "mb", "momo"]).map((a) => a.id);
    expect(ids.slice(0, 2)).toEqual(["momo", "mb"]);
    expect(ids).toHaveLength(PAY_APPS.length);
    expect(new Set(ids).size).toBe(PAY_APPS.length);
  });
});

describe("defaultAppId", () => {
  it("prefers the most recent, then the scanned bank, then the first", () => {
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo"]), ["mb"], "970423")).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, []), [], "970436")).toBe("vcb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, []), [])).toBe("tpbank");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo"]), [])).toBe("momo");
  });
});

describe("catalogue", () => {
  it("includes VietinBank and maps its BIN", () => {
    expect(PAY_APPS.some((a) => a.id === "icb" && a.scheme === "vietinbankipay")).toBe(true);
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, []), [], "970415")).toBe("icb");
  });
  it("has no autofill flags", () => {
    for (const a of PAY_APPS) {
      expect(a).not.toHaveProperty("supportsAutofill");
      expect(a).not.toHaveProperty("deeplinkCode");
    }
  });
  it("iOS LSApplicationQueriesSchemes match the app schemes", () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, "../../../../app.json"), "utf8"));
    const schemes: string[] = cfg.expo.ios.infoPlist.LSApplicationQueriesSchemes;
    expect([...schemes].sort()).toEqual(PAY_APPS.map((a) => a.scheme).sort());
  });
});
