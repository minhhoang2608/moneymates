import { chartColors, colors, layout, radii } from "@/theme";

describe("design tokens", () => {
  it("AC3: matches docs/design/README.md", () => {
    expect(colors.primary).toBe("#0E7C66");
    expect(colors.background).toBe("#F6F7F9");
    expect(colors.expense).toBe("#B42318");
    expect(colors.textMuted).toBe("#5B6472");
    expect(radii.card).toBe(16);
    expect(layout.tabBarHeight).toBe(84);
    expect(layout.qrButtonSize).toBe(60);
  });

  it("uses 6-digit upper-case hex for every colour", () => {
    for (const value of [...Object.values(colors), ...chartColors]) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
