import { parseReceipt } from "../parseReceipt";
import { genericRule, normaliseLines, tpbankRule } from "../rules";
import { garbage } from "./fixtures/garbage";
import { genericLabelled } from "./fixtures/generic";
import { tpbankLabelled, tpbankUnlabelled } from "./fixtures/tpbank";

const NULLS = {
  amount: null,
  recipient: null,
  bankName: null,
  accountNumber: null,
  message: null,
  paidAt: null,
  transactionId: null,
};

describe("parseReceipt", () => {
  it("AC1: TPBank positional text", () => {
    expect(parseReceipt(tpbankUnlabelled)).toEqual({
      ...NULLS,
      amount: 55000,
      recipient: "QUAN PHO HOA",
      bankName: "TPBank",
      accountNumber: "0123456789",
      message: "PHO HOA BAN 12",
    });
  });

  it("AC1/AC4: TPBank labelled text with spaced account", () => {
    expect(parseReceipt(tpbankLabelled)).toEqual({
      amount: 55000,
      recipient: "QUAN PHO HOA",
      bankName: "TPBank",
      accountNumber: "0123456789",
      message: "PHO HOA BAN 12",
      paidAt: "2026-03-05T11:30:12.000Z",
      transactionId: "FT26064123456789",
    });
  });

  it("AC2: amounts are integers", () => {
    for (const f of [tpbankLabelled, tpbankUnlabelled, genericLabelled]) {
      const a = parseReceipt(f).amount;
      expect(a === null || Number.isInteger(a)).toBe(true);
    }
    expect(parseReceipt(genericLabelled).amount).toBe(1250000);
  });

  it("AC3: empty or unreadable input gives all nulls without throwing", () => {
    for (const input of [[], ["", " "], garbage, [1, null, {}] as unknown as string[]]) {
      expect(() => parseReceipt(input)).not.toThrow();
      expect(parseReceipt(input)).toEqual(NULLS);
    }
    expect(parseReceipt(undefined as unknown as string[])).toEqual(NULLS);
  });

  it("AC5: unknown bank uses the generic fallback", () => {
    expect(parseReceipt(genericLabelled)).toEqual({
      amount: 1250000,
      recipient: "NGUYEN VAN A",
      bankName: "Vietcombank",
      accountNumber: "9876543210",
      message: "TIEN NHA THANG 3",
      paidAt: "2026-03-05T02:15:00.000Z",
      transactionId: null,
    });
  });

  it("AC5: fields missing from the TPBank rule are filled by the fallback", () => {
    const r = parseReceipt([
      "TPBank",
      "Số tiền: 10.000 VND",
      "Số tài khoản: 0123456789",
      "Mã giao dịch FT26064123456789",
    ]);
    expect(r.amount).toBe(10000);
    expect(r.accountNumber).toBe("0123456789");
    expect(r.transactionId).toBe("FT26064123456789");
    expect(r.recipient).toBeNull();
  });
});

describe("tpbankRule", () => {
  it("detects TPBank only", () => {
    expect(tpbankRule.detect(tpbankUnlabelled)).toBe(true);
    expect(tpbankRule.detect(genericLabelled)).toBe(false);
  });
  it("leaves ambiguous recipient null", () => {
    const lines = normaliseLines(["55.000 VND", "AAA", "BBB", "TPBank - 0123456789"]);
    expect(tpbankRule.parse(lines).recipient).toBeUndefined();
  });
});

describe("genericRule", () => {
  it("finds a currency-marked amount and bank account line without labels", () => {
    expect(genericRule.parse(normaliseLines(["foo", "55,000đ", "Vietcombank - 0123456789"]))).toEqual({
      amount: 55000,
      bankName: "Vietcombank",
      accountNumber: "0123456789",
    });
  });
});
