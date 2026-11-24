import { DEFAULT_ENABLED_APP_IDS, PAY_APPS } from "../apps";
import { partitionApps, resolveEnabled } from "../enabledApps";

describe("resolveEnabled", () => {
  it("uses detected installed apps when the user has not chosen", () => {
    expect(resolveEnabled({ hasChosen: false, saved: [], installed: ["momo", "mb"] })).toEqual(
      PAY_APPS.filter((a) => ["momo", "mb"].includes(a.id)).map((a) => a.id),
    );
  });
  it("falls back to the legacy default when nothing is detected", () => {
    expect(resolveEnabled({ hasChosen: false, saved: [], installed: [] })).toEqual(DEFAULT_ENABLED_APP_IDS);
  });
  it("the saved list wins once the user has chosen, even when empty", () => {
    expect(resolveEnabled({ hasChosen: true, saved: ["vcb"], installed: ["mb"] })).toEqual(["vcb"]);
    expect(resolveEnabled({ hasChosen: true, saved: [], installed: ["mb"] })).toEqual([]);
  });
});

describe("partitionApps", () => {
  it("keeps saved order and removes enabled apps from the groups", () => {
    const { enabled, banks, wallets } = partitionApps(PAY_APPS, ["momo", "mb", "nope"]);
    expect(enabled.map((a) => a.id)).toEqual(["momo", "mb"]);
    expect(banks.some((a) => a.id === "mb")).toBe(false);
    expect(wallets.map((a) => a.id)).toEqual(["zalopay", "vnpay"]);
    expect(banks.every((a) => a.type === "bank")).toBe(true);
  });
});
