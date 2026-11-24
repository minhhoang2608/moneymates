import { readFileSync } from "fs";
import { join } from "path";
import { SNAPSHOT } from "../../vietqr/bankApps";
import {
  FEATURED_APP_IDS,
  PAY_APPS,
  badgeKind,
  buildPayApps,
  defaultAppId,
  defaultEnabled,
  groupApps,
  searchApps,
  type PayApp,
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

describe("catalogue (#305)", () => {
  const ids = (l: PayApp[]) => l.map((a) => a.id);

  it("only MB, BIDV, VietinBank, ACB and OCB autofill; everything else is scan", () => {
    for (const os of ["ios", "android"] as const) {
      const apps = buildPayApps(SNAPSHOT, os);
      expect(ids(apps.filter((a) => a.supportsAutofill)).sort()).toEqual(["acb", "bidv", "icb", "mb", "ocb"]);
      apps.filter((a) => !a.supportsAutofill).forEach((a) => expect(badgeKind(a)).toBe("scan"));
      apps.filter((a) => a.supportsAutofill).forEach((a) => expect(badgeKind(a)).toBe("autofill"));
    }
  });

  it("groups wallets (MoMo, ZaloPay, VNPay) apart from banks", () => {
    const { banks, wallets } = groupApps(PAY_APPS);
    expect(ids(wallets)).toEqual(["momo", "zalopay", "vnpay"]);
    expect(banks.every((a) => a.type === "bank")).toBe(true);
    expect(banks.length + wallets.length).toBe(PAY_APPS.length);
    expect(new Set(ids(PAY_APPS)).size).toBe(PAY_APPS.length);
  });

  it("does not duplicate a wallet that the registry already has", () => {
    const data = {
      ...SNAPSHOT,
      apps: [...SNAPSHOT.apps, { ...SNAPSHOT.apps[0], app_id: "momo", name: "MoMo", bin: null, bank_code: null }],
    };
    const apps = buildPayApps(data, "ios");
    expect(ids(apps).filter((i) => i === "momo")).toHaveLength(1);
  });

  it("searchApps finds apps regardless of case, accents and spaces", () => {
    expect(ids(searchApps(PAY_APPS, "vnp"))).toEqual(["vnpay"]);
    expect(ids(searchApps(PAY_APPS, "  VNP "))).toEqual(["vnpay"]);
    expect(ids(searchApps(PAY_APPS, "zalo"))).toEqual(["zalopay"]);
    expect(searchApps(PAY_APPS, "zzzz")).toEqual([]);
    expect(searchApps(PAY_APPS, "")).toEqual(PAY_APPS);
    expect(searchApps(PAY_APPS, "   ")).toEqual(PAY_APPS);
  });

  it("defaultEnabled keeps installed apps in catalogue order", () => {
    const got = defaultEnabled(["momo", "tcb"]);
    expect(got.sort()).toEqual(["momo", "tcb"]);
    expect(ids(PAY_APPS.filter((a) => got.includes(a.id)))).toEqual(ids(PAY_APPS).filter((i) => got.includes(i)));
  });

  it("defaultEnabled orders by catalogue", () => {
    const order = ids(PAY_APPS);
    const got = defaultEnabled(["momo", "tcb"]);
    expect(got).toEqual(["tcb", "momo"].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });

  it("defaultEnabled falls back to the legacy list, normalizes ids, dedupes and returns a copy", () => {
    expect(defaultEnabled([])).toEqual(FEATURED_APP_IDS);
    expect(defaultEnabled([])).not.toBe(FEATURED_APP_IDS);
    expect(defaultEnabled(["com.foo"])).toEqual(FEATURED_APP_IDS);
    expect(defaultEnabled(["tpbank", "tpb"])).toEqual(["tpb"]);
  });

  it("works offline: the catalogue is built from the bundled snapshot", () => {
    const original = global.fetch;
    global.fetch = jest.fn(() => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    try {
      const apps = buildPayApps(SNAPSHOT, "android");
      expect(ids(groupApps(apps).wallets)).toEqual(["momo", "zalopay", "vnpay"]);
      expect(apps.length).toBeGreaterThan(3);
    } finally {
      global.fetch = original;
    }
  });
});
