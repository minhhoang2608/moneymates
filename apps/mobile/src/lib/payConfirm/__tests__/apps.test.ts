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
  it("prefers the most recent, then the scanned bank, then an autofill app", () => {
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo"]), ["mb"], "970423")).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, []), [], "970436")).toBe("vcb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, []), [])).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo"]), [])).toBe("mb");
  });
});

describe("catalogue", () => {
  it("autofill flags follow the VietQR registry", () => {
    const auto = PAY_APPS.filter((a) => a.supportsAutofill).map((a) => a.id);
    expect(auto.sort()).toEqual(["acb", "bidv", "icb", "mb", "ocb"]);
    for (const id of ["tcb", "tpbank", "vcb"]) expect(PAY_APPS.find((a) => a.id === id)!.supportsAutofill).toBe(false);
  });
  it("maps BINs and defaults to an autofill app for an unknown bank", () => {
    const ordered = orderAppsBySaved(PAY_APPS, []);
    expect(defaultAppId(ordered, [], "970415")).toBe("icb");
    expect(defaultAppId(ordered, [], "970418")).toBe("bidv");
    expect(defaultAppId(ordered, [], "999999")).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo"]), [])).toBe("mb");
  });
  it("iOS LSApplicationQueriesSchemes match the known app schemes", () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, "../../../../app.json"), "utf8"));
    const schemes: string[] = cfg.expo.ios.infoPlist.LSApplicationQueriesSchemes;
    expect([...schemes].sort()).toEqual(
      PAY_APPS.map((a) => a.scheme)
        .filter((s): s is string => !!s)
        .sort(),
    );
  });
});
