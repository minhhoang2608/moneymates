import { initials, validateDisplayName } from "../displayName";

describe("validateDisplayName", () => {
  it("trims a valid name", () => {
    expect(validateDisplayName("  Hoàng ")).toEqual({ ok: true, name: "Hoàng" });
  });
  it("rejects empty and whitespace", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, error: "empty" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, error: "empty" });
  });
});

describe("initials", () => {
  it("handles names", () => {
    expect(initials("Hoàng Lê")).toBe("HL");
    expect(initials("hoàng")).toBe("H");
    expect(initials("Nguyễn Văn An")).toBe("NA");
    expect(initials("")).toBe("?");
    expect(initials("  ")).toBe("?");
  });
});
