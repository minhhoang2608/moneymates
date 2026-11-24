import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { expo } = JSON.parse(readFileSync(resolve(__dirname, "../../app.json"), "utf8"));
const entry = (expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === "expo-share-intent") as
  [string, Record<string, unknown>] | undefined;

describe("share target config", () => {
  it("registers the share-intent plugin for images only", () => {
    expect(entry).toBeDefined();
    const opts = entry![1];
    expect(opts.androidIntentFilters).toEqual(["image/*"]);
    expect(opts.androidMultiIntentFilters).toEqual([]);
    expect(opts.disableIOS).toBe(false);
    expect(opts.iosActivationRules).toEqual({ NSExtensionActivationSupportsImageWithMaxCount: 1 });
    expect(opts.iosAppGroupIdentifier).toBe("group.com.moneymates.app");
  });

  it("is pinned in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8"));
    expect(pkg.dependencies["expo-share-intent"]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
