import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

function pngSize(rel: string) {
  const buf = readFileSync(resolve(root, rel));
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("app config", () => {
  const { expo } = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8"));

  it("AC4: icon is a 1024x1024 PNG", () => {
    expect(pngSize(expo.icon)).toEqual({ width: 1024, height: 1024 });
  });

  it("AC4: adaptive icon foreground is a 1024x1024 PNG on the primary colour", () => {
    expect(pngSize(expo.android.adaptiveIcon.foregroundImage)).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(expo.android.adaptiveIcon.backgroundColor).toBe("#0E7C66");
  });

  it("favicon exists and is a PNG", () => {
    expect(pngSize(expo.web.favicon).width).toBeGreaterThan(0);
  });
});
