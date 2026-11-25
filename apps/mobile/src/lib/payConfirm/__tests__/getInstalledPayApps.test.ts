import * as Linking from "expo-linking";

import { getInstalledPayApps } from "../getInstalledPayApps";

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.EXPO_PUBLIC_E2E;
});

describe("getInstalledPayApps", () => {
  it("returns [] when the probe throws", async () => {
    jest.spyOn(Linking, "canOpenURL").mockRejectedValue(new Error("boom"));
    expect(await getInstalledPayApps()).toEqual([]);
  });

  it("returns the apps whose scheme can be opened", async () => {
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    expect((await getInstalledPayApps()).length).toBeGreaterThan(0);
  });

  it("uses the E2E fixture in E2E mode", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    const probe = jest.spyOn(Linking, "canOpenURL");
    await getInstalledPayApps();
    expect(probe).not.toHaveBeenCalled();
  });
});
