import { SNAPSHOT, parseBankAppsResponse } from "../bankApps";

const APP_KEYS = ["android_package", "app_id", "autofill", "bank_code", "bin", "ios_scheme", "logo", "name"];

describe("GET /banks/apps contract", () => {
  it("AC2: the bundled snapshot satisfies the guard and the key list", () => {
    expect(parseBankAppsResponse(SNAPSHOT)).not.toBeNull();
    expect(Object.keys(SNAPSHOT).sort()).toEqual(["apps", "stale", "updated_at"]);
    for (const a of SNAPSHOT.apps) {
      expect(Object.keys(a).sort()).toEqual(APP_KEYS);
      expect(Object.keys(a.autofill).sort()).toEqual(["android", "ios"]);
    }
  });

  it("rejects bad bodies", () => {
    const app = SNAPSHOT.apps[0];
    const { autofill: _a, ...noAutofill } = app;
    expect(parseBankAppsResponse({ ...SNAPSHOT, apps: [noAutofill] })).toBeNull();
    expect(parseBankAppsResponse({ ...SNAPSHOT, stale: "no" })).toBeNull();
    expect(parseBankAppsResponse({ ...SNAPSHOT, apps: [] })).toBeNull();
    expect(parseBankAppsResponse("x")).toBeNull();
    expect(parseBankAppsResponse(null)).toBeNull();
  });
});
