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
