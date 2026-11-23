import { generateVietQr } from "../generate";

function tags(s: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < s.length) {
    const len = Number(s.slice(i + 2, i + 4));
    out.push([s.slice(i, i + 2), s.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

describe("generateVietQr", () => {
  it("static QR has no amount tag", () => {
    const p = generateVietQr({ bankBin: "970422", account: "0123456789" });
    expect(p.startsWith("000201010211")).toBe(true);
    expect(tags(p).map(([id]) => id)).toEqual(["00", "01", "38", "53", "58", "63"]);
  });
  it("dynamic QR has amount and tag order", () => {
    const p = generateVietQr({
      bankBin: "970422",
      account: "0123456789",
      amount: 250000,
      name: "Nguyễn Văn A",
      message: "Da Lat An",
    });
    expect(p).toContain("010212");
    expect(p).toContain("5406250000");
    expect(tags(p).map(([id]) => id)).toEqual(["00", "01", "38", "53", "54", "58", "59", "62", "63"]);
    expect(tags(p).find(([id]) => id === "59")![1]).toBe("Nguyen Van A");
  });
  it("rejects invalid amounts", () => {
    for (const amount of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => generateVietQr({ bankBin: "970422", account: "1", amount })).toThrow();
    }
  });
  it("rejects invalid bin or account", () => {
    expect(() => generateVietQr({ bankBin: "9704", account: "1" })).toThrow();
    expect(() => generateVietQr({ bankBin: "970422", account: "" })).toThrow();
    expect(() => generateVietQr({ bankBin: "970422", account: "1".repeat(20) })).toThrow();
  });
  it("sanitises and caps the message", () => {
    const p = generateVietQr({ bankBin: "970422", account: "1", message: "Đà Lạt ".repeat(10) });
    const t62 = tags(p).find(([id]) => id === "62")![1];
    expect(tags(t62)[0]![1].length).toBeLessThanOrEqual(25);
  });
});
