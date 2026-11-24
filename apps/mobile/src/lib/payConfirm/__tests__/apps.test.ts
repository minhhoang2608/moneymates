import { readFileSync } from "fs";
import { join } from "path";
import {
  FEATURED_APP_IDS,
  PAY_APPS,
  defaultAppId,
  filterApps,
  normalizeAppId,
  orderAppsBySaved,
  orderPickerApps,
} from "../apps";

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
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo", ...FEATURED_APP_IDS]), ["mb"], "970423")).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, FEATURED_APP_IDS), [], "970436")).toBe("vcb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, FEATURED_APP_IDS), [])).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo", ...FEATURED_APP_IDS]), [])).toBe("mb");
  });
});

describe("catalogue", () => {
  it("autofill flags follow the VietQR registry", () => {
    const auto = PAY_APPS.filter((a) => a.supportsAutofill).map((a) => a.id);
    expect(auto.sort()).toEqual(["acb", "bidv", "icb", "mb", "ocb"]);
    for (const id of ["tcb", "tpb", "vcb"]) expect(PAY_APPS.find((a) => a.id === id)!.supportsAutofill).toBe(false);
  });
  it("maps BINs and defaults to an autofill app for an unknown bank", () => {
    const ordered = orderAppsBySaved(PAY_APPS, FEATURED_APP_IDS);
    expect(defaultAppId(ordered, [], "970415")).toBe("icb");
    expect(defaultAppId(ordered, [], "970418")).toBe("bidv");
    expect(defaultAppId(ordered, [], "999999")).toBe("mb");
    expect(defaultAppId(orderAppsBySaved(PAY_APPS, ["momo", ...FEATURED_APP_IDS]), [])).toBe("mb");
  });
  it("iOS LSApplicationQueriesSchemes match the known app schemes", () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, "../../../../app.json"), "utf8"));
    const schemes: string[] = cfg.expo.ios.infoPlist.LSApplicationQueriesSchemes;
    expect([...schemes].sort()).toEqual(
      [...new Set(PAY_APPS.map((a) => a.scheme).filter((s): s is string => !!s))].sort(),
    );
  });
});

describe("orderPickerApps", () => {
  const ids = (o: Parameters<typeof orderPickerApps>[1]) => orderPickerApps(PAY_APPS, o).map((a) => a.id);
  it("orders preferred, recent, scanned bank, then the rest without duplicates", () => {
    const out = ids({ preferred: ["tcb"], recent: ["mb"], scannedBin: "970436" });
    expect(out.slice(0, 3)).toEqual(["tcb", "mb", "vcb"]);
    expect(out).toHaveLength(PAY_APPS.length);
    expect(new Set(out).size).toBe(PAY_APPS.length);
  });
  it("handles unknown and legacy ids, an already preferred scanned app and no BIN", () => {
    const out = ids({ preferred: ["ghost", "vcb"], recent: ["tpbank", "vcb"], scannedBin: "970436" });
    expect(out.slice(0, 2)).toEqual(["vcb", "tpb"]);
    expect(out).toHaveLength(PAY_APPS.length);
    expect(ids({ preferred: [], recent: [] })).toHaveLength(PAY_APPS.length);
  });
  it("normalises legacy ids", () => expect(normalizeAppId("tpbank")).toBe("tpb"));
});

describe("filterApps", () => {
  it("matches name, code and id ignoring case and diacritics", () => {
    expect(filterApps(PAY_APPS, "tech").map((a) => a.id)).toEqual(["tcb"]);
    expect(filterApps(PAY_APPS, "VIETINBANK").map((a) => a.id)).toContain("icb");
    expect(filterApps(PAY_APPS, "zzzz")).toEqual([]);
  });
  it("returns everything for a blank query", () => expect(filterApps(PAY_APPS, "  ")).toEqual(PAY_APPS));
});

describe("buildPayApps (live list)", () => {
  const { buildPayApps, appIdForBin: binLookup } = jest.requireActual("../apps") as typeof import("../apps");
  const live = {
    updated_at: "x",
    stale: false,
    apps: [
      {
        app_id: "momo",
        name: "MoMo",
        logo: null,
        bank_code: null,
        bin: null,
        autofill: { android: false, ios: false },
        ios_scheme: null,
        android_package: null,
      },
      {
        app_id: "zzz",
        name: "ZZZ",
        logo: null,
        bank_code: "ZZZ",
        bin: "970999",
        autofill: { android: true, ios: true },
        ios_scheme: null,
        android_package: null,
      },
    ],
  };
  it("does not duplicate momo", () => {
    expect(buildPayApps(live, "android").filter((a) => a.id === "momo")).toHaveLength(1);
  });
  it("resolves a BIN on the live list", () => {
    expect(binLookup("970999", buildPayApps(live, "android"))).toBe("zzz");
  });
});
