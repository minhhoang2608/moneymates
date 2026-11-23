import { generateVietQr } from "../generate";
import { crc16ccitt } from "../crc16";
import { parseVietQr } from "../parse";
import { encodeTlvList } from "../tlv";

const withCrc = (body: string) => `${body}6304${crc16ccitt(`${body}6304`)}`;

describe("parseVietQr", () => {
  it("parses a generated dynamic code", () => {
    const p = generateVietQr({ bankBin: "970423", account: "0123456789", amount: 55000, message: "PHO 24" });
    expect(parseVietQr(p)).toEqual({
      kind: "vietqr",
      bankBin: "970423",
      bankName: "TPBank",
      account: "0123456789",
      amount: 55000,
      message: "PHO 24",
      isDynamic: true,
    });
  });
  it("static code has no amount", () => {
    const r = parseVietQr(generateVietQr({ bankBin: "970423", account: "0123456789" }));
    expect(r).toMatchObject({ kind: "vietqr", isDynamic: false });
    expect(r.kind === "vietqr" && r.amount).toBeUndefined();
  });
  it("tolerates surrounding whitespace and unknown BIN", () => {
    const r = parseVietQr(`\n${generateVietQr({ bankBin: "999999", account: "123" })}\r\n`);
    expect(r).toMatchObject({ kind: "vietqr", bankName: "999999" });
  });
  it("returns other for non-NAPAS merchant codes and tag 38 without account", () => {
    const merchant = encodeTlvList([
      ["00", "01"],
      ["01", "11"],
      [
        "26",
        encodeTlvList([
          ["00", "A000000775"],
          ["01", "MERCHANT"],
        ]),
      ],
      ["58", "VN"],
    ]);
    expect(parseVietQr(withCrc(merchant))).toEqual({ kind: "other" });
    const noAccount = encodeTlvList([
      ["00", "01"],
      ["01", "11"],
      ["38", encodeTlvList([["00", "A000000727"]])],
      ["58", "VN"],
    ]);
    expect(parseVietQr(withCrc(noAccount))).toEqual({ kind: "other" });
  });
  it("reports crc mismatch and malformed input without throwing", () => {
    const p = generateVietQr({ bankBin: "970423", account: "0123456789" });
    const bad = p.slice(0, -4) + (p.endsWith("0000") ? "1111" : "0000");
    expect(parseVietQr(bad)).toEqual({ kind: "invalid", reason: "crc_mismatch" });
    for (const x of [
      p.slice(0, 30),
      "",
      "   ",
      null,
      42,
      "ABCDEF",
      p.slice(0, -4),
      p.slice(0, -4) + "abcd",
      "0002010102116304",
    ]) {
      expect(parseVietQr(x)).toMatchObject({ kind: "invalid" });
    }
  });
  it("rejects non-integer amounts", () => {
    for (const amt of ["55000.5", "abc"]) {
      const body = encodeTlvList([
        ["00", "01"],
        ["54", amt],
        ["58", "VN"],
      ]);
      expect(parseVietQr(withCrc(body))).toEqual({ kind: "invalid", reason: "malformed" });
    }
  });
  it("round-trips generator input", () => {
    const inputs = [
      { bankBin: "970436", account: "0011", amount: 1000000, message: "Tien an", name: "NGUYEN VAN A" },
      { bankBin: "970422", account: "ABC123" },
      { bankBin: "970415", account: "99", service: "QRIBFTTC" as const, amount: 5 },
    ];
    for (const x of inputs) {
      const r = parseVietQr(generateVietQr(x));
      if (r.kind !== "vietqr") throw new Error("expected vietqr");
      expect({ bankBin: r.bankBin, account: r.account, name: r.name, amount: r.amount, message: r.message }).toEqual({
        bankBin: x.bankBin,
        account: x.account,
        name: (x as { name?: string }).name,
        amount: x.amount,
        message: (x as { message?: string }).message,
      });
    }
  });
});
