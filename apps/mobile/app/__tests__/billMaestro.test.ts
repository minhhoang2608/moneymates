import fs from "fs";
import path from "path";

import { vi } from "../../src/i18n/vi";

const dir = path.join(__dirname, "..", "..", ".maestro");
const read = (f: string) => fs.readFileSync(path.join(dir, `${f}.yaml`), "utf8");
const FLOWS = ["bill-scan", "bill-fill-form"];

describe("bill maestro flows", () => {
  it("bill-fill-form scrolls until the photo thumbnail is visible before asserting it", () => {
    const src = read("bill-fill-form");
    expect(src).toMatch(/scrollUntilVisible:\s*\n\s*element:\s*\n\s*id: "photo-thumbnail"/);
    expect(src.indexOf("scrollUntilVisible")).toBeLessThan(src.indexOf('assertVisible:\n    id: "photo-thumbnail"'));
    expect(src.trimEnd().endsWith('- assertVisible: "345.000đ"')).toBe(true);
  });

  it.each(FLOWS)("%s waits on the bill-done id, not heading text", (f) => {
    const src = read(f);
    expect(src).toMatch(/extendedWaitUntil:\s*\n\s*visible:\s*\n\s*id: "bill-done"/);
    expect(src).not.toMatch(/visible: "(✓ )?AI đã đọc xong bill"/);
  });

  it.each(FLOWS)("%s asserts the fixture values", (f) => {
    const src = read(f);
    for (const v of ["345.000đ", "Bánh căn Nhà Chung", "22/11/2026", "Ăn uống"]) {
      expect(src).toContain(`- assertVisible: "${v}"`);
    }
  });

  it("bill screen keeps the testID and heading text", () => {
    const tsx = fs.readFileSync(path.join(__dirname, "..", "bill.tsx"), "utf8");
    expect(tsx).toContain('testID="bill-done"');
    expect(vi.bill.done).toBe("AI đã đọc xong bill");
  });
});
