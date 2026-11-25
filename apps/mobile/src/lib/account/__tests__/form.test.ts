import { isAccountNoNumeric, normalizeHolderName, validateAccountForm } from "../form";

describe("validateAccountForm", () => {
  it("requires a bank", () => {
    expect(validateAccountForm({ bank_bin: null, account_no: "123" })).toEqual({ bank_required: true });
  });
  it("requires a non-blank account number", () => {
    expect(validateAccountForm({ bank_bin: "970423", account_no: "  " })).toEqual({ account_no_required: true });
    expect(validateAccountForm({ bank_bin: "970423", account_no: "" })).toEqual({ account_no_required: true });
  });
  it("accepts valid input", () => {
    expect(validateAccountForm({ bank_bin: "970423", account_no: "0123456789" })).toEqual({});
  });
});

describe("normalizeHolderName", () => {
  it("strips diacritics and upper-cases", () => {
    expect(normalizeHolderName("Nguyễn Văn Hoàng")).toBe("NGUYEN VAN HOANG");
    expect(normalizeHolderName("  đỗ   thị  ")).toBe("DO THI");
  });
});

describe("isAccountNoNumeric", () => {
  it("accepts digits only", () => {
    expect(isAccountNoNumeric("0123456789")).toBe(true);
    expect(isAccountNoNumeric("0123 456")).toBe(true);
    expect(isAccountNoNumeric("")).toBe(false);
    expect(isAccountNoNumeric("12a3")).toBe(false);
    expect(isAccountNoNumeric("12-3")).toBe(false);
  });
});
