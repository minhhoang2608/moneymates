import { CATEGORY_COLORS, tintFor } from "../palette";

describe("tintFor", () => {
  it("maps a stored foreground colour to its tint", () => {
    expect(tintFor("#0E7C66")).toBe("#E7F4F0");
    expect(tintFor("#6b4423")).toBe("#F5EDE4");
  });
  it("falls back to the neutral tint", () => {
    expect(tintFor("#123456")).toBe("#EEF0F3");
  });
  it("offers 11 colours", () => {
    expect(CATEGORY_COLORS).toHaveLength(11);
  });
});
