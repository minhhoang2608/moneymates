import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "..", "..", ".maestro");
const read = (f: string) => fs.readFileSync(path.join(dir, `${f}.yaml`), "utf8");
const SCROLL = /scrollUntilVisible:\s*\n\s*element:\s*\n\s*id: "pay-app-row-name"/g;
const ASSERT = 'assertVisible:\n    id: "pay-app-row-name"';

describe("pay app row maestro flows", () => {
  it("pay-app-change scrolls to pay-app-row-name before each row assert", () => {
    const src = read("pay-app-change");
    const scrolls = [...src.matchAll(SCROLL)].map((m) => m.index as number);
    expect(scrolls).toHaveLength(2);
    const tp = src.indexOf(`${ASSERT}\n    text: "TPBank"`);
    const mb = src.indexOf(`${ASSERT}\n    text: "MBBank"`);
    expect(src.indexOf("screen-pay-confirm")).toBeLessThan(scrolls[0]);
    expect(scrolls[0]).toBeLessThan(tp);
    expect(src.indexOf('id: "app-mb"')).toBeLessThan(scrolls[1]);
    expect(scrolls[1]).toBeLessThan(mb);
  });

  it("settings-effects scrolls to the pay app row after opening pay-confirm", () => {
    const src = read("settings-effects");
    const scroll = src.search(SCROLL);
    expect(scroll).toBeGreaterThan(src.indexOf("screen-pay-confirm"));
    expect(scroll).toBeLessThan(src.lastIndexOf(`${ASSERT}\n    text: "TPBank"`));
  });

  it("PayAppRow keeps the testIDs the flows scroll to", () => {
    const tsx = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "payConfirm", "PayAppRow.tsx"),
      "utf8",
    );
    expect(tsx).toContain("pay-app-row-name");
    expect(tsx).toContain("pay-app-change");
  });

  it("pay-paste-mode asserts handoff-reopen is not visible after the saved line", () => {
    const src = read("pay-paste-mode");
    expect(src.indexOf('assertNotVisible:\n    id: "handoff-reopen"')).toBeGreaterThan(src.indexOf("Đã lưu 55"));
  });
});
