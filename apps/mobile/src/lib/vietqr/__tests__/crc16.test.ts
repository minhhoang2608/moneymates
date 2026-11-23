import { crc16ccitt, hasValidCrc } from "../crc16";
import { generateVietQr } from "../generate";

describe("crc16", () => {
  it("matches the CCITT-FALSE check value", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
  it("accepts generated payloads", () => {
    const inputs = [
      { bankBin: "970422", account: "0123456789" },
      { bankBin: "970436", account: "1", amount: 1 },
      { bankBin: "970423", account: "00001234567", amount: 250000, message: "Da Lat An", name: "Nguyen Van A" },
    ];
    for (const i of inputs) expect(hasValidCrc(generateVietQr(i))).toBe(true);
  });
  it("accepts a golden payload", () => {
    expect(
      hasValidCrc("00020101021138550010A000000727012500069704230111000012345670208QRIBFTTA53037045802VN63042080"),
    ).toBe(true);
  });
  it("rejects tampered, lowercase or missing crc", () => {
    const p = generateVietQr({ bankBin: "970422", account: "0123456789", amount: 5000 });
    const flipped = p[10] === "1" ? "2" : "1";
    expect(hasValidCrc(p.slice(0, 10) + flipped + p.slice(11))).toBe(false);
    expect(hasValidCrc(p.slice(0, -4) + p.slice(-4).toLowerCase().replace(/[0-9]/g, "a"))).toBe(false);
    expect(hasValidCrc(p.slice(0, -4))).toBe(false);
    expect(hasValidCrc("")).toBe(false);
  });
  it("rejects lowercase crc with valid value", () => {
    const body = "000201" + "6304";
    const crc = crc16ccitt(body);
    expect(hasValidCrc(body + crc)).toBe(true);
    if (/[A-F]/.test(crc)) expect(hasValidCrc(body + crc.toLowerCase())).toBe(false);
  });
});
