import { PAY_APPS } from "../apps";
import { detectInstalledApps } from "../installedApps";

describe("detectInstalledApps", () => {
  it("returns apps whose scheme can be opened", async () => {
    const ids = await detectInstalledApps(PAY_APPS, async (url) => url === "momo://");
    expect(ids).toEqual(["momo"]);
  });
  it("treats a throwing probe as not installed", async () => {
    const ids = await detectInstalledApps(PAY_APPS, async () => {
      throw new Error("boom");
    });
    expect(ids).toEqual([]);
  });
  it("skips apps without a scheme", async () => {
    const probe = jest.fn(async () => true);
    const ids = await detectInstalledApps(PAY_APPS, probe);
    expect(ids).not.toContain("zalopay");
    expect(probe).toHaveBeenCalledTimes(PAY_APPS.filter((a) => a.scheme).length);
  });
});
