import { hasValidCrc, parseVietQr } from "@/lib/vietqr";

import type { PayConfirmModel } from "../params";
import { buildConfirmedQrPayload } from "../qrPayload";
import { shareConfirmedQr } from "../shareQr";

const scanned =
  "00020101021238540010A00000072701240006970423011001234567890208QRIBFTTA53037045405550005802VN5912NGUYEN VAN A62100806PHO 2463048D0E";
const model: PayConfirmModel = {
  kind: "vietqr",
  bankName: "TPBank",
  bankBin: "970423",
  account: "0123456789",
  name: "NGUYEN VAN A",
  amount: 55000,
  message: "PHO 24",
  isDynamic: true,
  payload: scanned,
};

describe("buildConfirmedQrPayload", () => {
  it("leaves out the merchant name so bank apps read it like a bank-issued VietQR", () => {
    const p = buildConfirmedQrPayload(model, 80000, "Ca phe");
    expect(p).not.toContain("5912NGUYEN VAN A");
    expect(p.startsWith("000201010212")).toBe(true);
  });
  it("uses the edited amount and message with a valid CRC", () => {
    const p = buildConfirmedQrPayload(model, 80000, "Ca phe");
    expect(hasValidCrc(p)).toBe(true);
    const r = parseVietQr(p);
    expect(r).toMatchObject({
      kind: "vietqr",
      amount: 80000,
      message: "Ca phe",
      account: "0123456789",
      bankBin: "970423",
    });
  });
  it("scanned QR without an amount: the new QR carries the confirmed amount", () => {
    const p = buildConfirmedQrPayload(
      { ...model, amount: undefined, message: undefined, payload: "static" },
      30000,
      "",
    );
    expect(hasValidCrc(p)).toBe(true);
    expect(parseVietQr(p)).toMatchObject({ kind: "vietqr", amount: 30000 });
    expect(p).not.toBe("static");
  });
  it("no amount entered → static QR; non-VietQR keeps the scanned payload", () => {
    expect(hasValidCrc(buildConfirmedQrPayload(model, undefined, ""))).toBe(true);
    expect(buildConfirmedQrPayload({ ...model, kind: "other" }, 1, "x")).toBe(scanned);
  });
  it("invalid account → falls back to the scanned payload", () => {
    expect(buildConfirmedQrPayload({ ...model, account: "bad account!" }, 1, "")).toBe(scanned);
  });
});

describe("shareConfirmedQr", () => {
  it("copies the text then shares the image", async () => {
    const calls: string[] = [];
    const res = await shareConfirmedQr(
      {
        getQrBase64: async () => "B64",
        setClipboard: async (t) => void calls.push(`clip:${t}`),
        share: async (b) => (calls.push(`share:${b}`), "shared" as const),
      },
      "0123 60000 PHO",
    );
    expect(res).toBe("shared");
    expect(calls).toEqual(["clip:0123 60000 PHO", "share:B64"]);
  });
  it("no QR image → unavailable, nothing shared", async () => {
    const share = jest.fn();
    expect(await shareConfirmedQr({ getQrBase64: async () => null, setClipboard: jest.fn(), share }, "x")).toBe(
      "unavailable",
    );
    expect(share).not.toHaveBeenCalled();
  });
});
