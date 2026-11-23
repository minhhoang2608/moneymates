import fs from "node:fs";
import path from "node:path";

import { getApiUrl, getAppSecret } from "../config";

describe("api config", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it("AC5: reads EXPO_PUBLIC_API_URL and trims trailing slashes", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.test//";
    expect(getApiUrl()).toBe("https://api.test");
  });

  it("AC5: returns null when unset", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getApiUrl()).toBeNull();
  });

  it("AC5: no hard-coded host in src/api", () => {
    const dir = path.join(__dirname, "..");
    for (const f of fs.readdirSync(dir).filter((n) => /\.tsx?$/.test(n))) {
      expect(fs.readFileSync(path.join(dir, f), "utf8")).not.toMatch(/https?:\/\//);
    }
  });
});

describe("getAppSecret", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_APP_SECRET;
  });
  it("trims and returns null when unset", () => {
    expect(getAppSecret()).toBeNull();
    process.env.EXPO_PUBLIC_APP_SECRET = " s3 ";
    expect(getAppSecret()).toBe("s3");
  });
});
