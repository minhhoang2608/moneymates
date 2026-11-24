import { parseBankNotification } from "..";
import { SAMPLES } from "../__fixtures__/samples";

describe("parseBankNotification", () => {
  describe.each(Object.entries(SAMPLES))("%s", (_bank, { packageName, samples }) => {
    it("has debit, credit and non-transaction samples", () => {
      const dirs = samples.map((s) => s.expected?.direction ?? "none");
      expect(dirs).toEqual(expect.arrayContaining(["out", "in", "none"]));
    });

    it.each(samples.map((s) => [s.text, s] as const))("%s", (_t, s) => {
      const r = parseBankNotification(packageName, s.title, s.text);
      expect(r).toEqual(s.expected);
      if (r) expect(Number.isInteger(r.amount)).toBe(true);
    });
  });

  it("AC1: TPBank debit", () => {
    expect(
      parseBankNotification(
        "com.tpb.mb.gprsandroid",
        "TPBank",
        "TK …4567 -55,000 VND lúc 12:03 24/11. ND: PHO HOA BAN 12",
      ),
    ).toEqual({
      direction: "out",
      amount: 55000,
      accountSuffix: "4567",
      message: "PHO HOA BAN 12",
    });
  });

  it("AC2: sign decides direction, amount is positive", () => {
    const pkg = "com.tpb.mb.gprsandroid";
    expect(parseBankNotification(pkg, "", "TK …1111 +55,000 VND")?.direction).toBe("in");
    expect(parseBankNotification(pkg, "", "TK …1111 -50,000 VND")?.amount).toBe(50000);
  });

  it("returns null for unknown package and empty text", () => {
    expect(parseBankNotification("com.example", "", "TK …1 -5,000 VND")).toBeNull();
    expect(parseBankNotification("com.mbmobile", "", "")).toBeNull();
    expect(parseBankNotification("com.mbmobile", "", "   ")).toBeNull();
  });
});
