import { extractAmount, extractBankAccount, extractPaidAt, extractTransactionId, normaliseAccount } from "../fields";

describe("extractAmount", () => {
  it.each([
    ["55.000 VND", 55000],
    ["55,000đ", 55000],
    ["1.250.000", 1250000],
    ["-1.250.000 VND", 1250000],
    ["55.5 VND", null],
    ["", null],
    ["abc", null],
  ])("%s -> %s", (input, expected) => {
    expect(extractAmount(input)).toBe(expected);
  });
});

describe("normaliseAccount", () => {
  it("keeps digits only", () => expect(normaliseAccount("0123 4567 89")).toBe("0123456789"));
  it("rejects too short or non-numeric", () => {
    expect(normaliseAccount("123")).toBeNull();
    expect(normaliseAccount("12ab56789")).toBeNull();
  });
});

describe("extractBankAccount", () => {
  it("resolves a known bank", () =>
    expect(extractBankAccount("TPBank - 0123 4567 89")).toEqual({ bankName: "TPBank", accountNumber: "0123456789" }));
  it("leaves unknown banks null", () =>
    expect(extractBankAccount("Foo Bank - 0123456789")).toEqual({ bankName: null, accountNumber: "0123456789" }));
  it("returns null for plain text", () => expect(extractBankAccount("PHO HOA BAN 12")).toBeNull());
});

describe("extractPaidAt", () => {
  it("converts +07:00 time-first to UTC", () =>
    expect(extractPaidAt("18:30:12 05/03/2026")).toBe("2026-03-05T11:30:12.000Z"));
  it("handles date-first", () => expect(extractPaidAt("05/03/2026 09:15")).toBe("2026-03-05T02:15:00.000Z"));
  it("rejects invalid dates", () => {
    expect(extractPaidAt("12:00 31/02/2026")).toBeNull();
    expect(extractPaidAt("25:00 01/01/2026")).toBeNull();
  });
});

describe("extractTransactionId", () => {
  it("reads labelled ids", () =>
    expect(extractTransactionId("Mã giao dịch: FT26064123456789")).toBe("FT26064123456789"));
  it("reads bare FT tokens", () => expect(extractTransactionId("ref FT26064123456789 ok")).toBe("FT26064123456789"));
  it("returns null otherwise", () => expect(extractTransactionId("hello")).toBeNull());
});
