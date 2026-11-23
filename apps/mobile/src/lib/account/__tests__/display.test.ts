import { bankTint, formatAccountNo } from "../display";

describe("formatAccountNo", () => {
  it("groups digits by 4", () => {
    expect(formatAccountNo("190345676789")).toBe("1903 4567 6789");
    expect(formatAccountNo("0456789123")).toBe("0456 7891 23");
    expect(formatAccountNo("123")).toBe("123");
    expect(formatAccountNo("1234")).toBe("1234");
  });
  it("ignores spaces", () => {
    expect(formatAccountNo("1234 5678")).toBe("1234 5678");
  });
});

describe("bankTint", () => {
  it("falls back to neutral", () => {
    expect(bankTint("XYZ").fg).toBeDefined();
    expect(bankTint("TPB")).not.toEqual(bankTint("TCB"));
  });
});
