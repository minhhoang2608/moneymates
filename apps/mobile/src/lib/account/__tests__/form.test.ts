import { validateAccountForm } from "../form";

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
