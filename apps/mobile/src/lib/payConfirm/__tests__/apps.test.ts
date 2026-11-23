import { PAY_APPS, defaultAppId, orderApps } from "../apps";

describe("orderApps", () => {
  it("keeps catalogue order without history", () => {
    expect(orderApps(PAY_APPS, []).map((a) => a.id)).toEqual(PAY_APPS.map((a) => a.id));
  });
  it("puts recent apps first, newest on top, ignoring unknown ids", () => {
    const ids = orderApps(PAY_APPS, ["mb", "ghost", "momo"]).map((a) => a.id);
    expect(ids.slice(0, 2)).toEqual(["mb", "momo"]);
    expect(ids).toHaveLength(PAY_APPS.length);
  });
});

describe("defaultAppId", () => {
  it("prefers the most recent, then the scanned bank, then the first", () => {
    expect(defaultAppId(orderApps(PAY_APPS, ["mb"]), ["mb"], "970423")).toBe("mb");
    expect(defaultAppId(orderApps(PAY_APPS, []), [], "970436")).toBe("vcb");
    expect(defaultAppId(orderApps(PAY_APPS, []), [])).toBe("tpbank");
  });
});
