import { BANKS, findBankByBin, findBankByName } from "../banks";

describe("banks", () => {
  it("finds by BIN", () => {
    expect(findBankByBin("970422")?.shortName).toBe("MB");
    expect(findBankByBin("970436")?.shortName).toBe("Vietcombank");
    expect(findBankByBin("970423")?.shortName).toBe("TPBank");
    expect(findBankByBin("970407")?.shortName).toBe("Techcombank");
    expect(findBankByBin("000000")).toBeUndefined();
  });
  it("finds by name, code, ignoring case/diacritics/spaces", () => {
    expect(findBankByName("vietcombank")?.bin).toBe("970436");
    expect(findBankByName("VCB")?.bin).toBe("970436");
    expect(findBankByName("Techcombank")?.bin).toBe("970407");
    expect(findBankByName("tp bank")?.bin).toBe("970423");
    expect(findBankByName("TPBank")?.bin).toBe("970423");
    expect(findBankByName("MB")?.bin).toBe("970422");
    expect(findBankByName("Ngân hàng TMCP Quân đội")?.bin).toBe("970422");
    expect(findBankByName("nope")).toBeUndefined();
    expect(findBankByName("")).toBeUndefined();
  });
  it("has unique 6-digit BINs and unique codes", () => {
    expect(BANKS.every((b) => /^\d{6}$/.test(b.bin))).toBe(true);
    expect(new Set(BANKS.map((b) => b.bin)).size).toBe(BANKS.length);
    expect(new Set(BANKS.map((b) => b.code)).size).toBe(BANKS.length);
  });
});
