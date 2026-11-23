import { decodeTlv, generateVietQr, parseVietQr } from "../../vietqr";
import { accountQrPayload } from "../qrPayload";

const acc = { bank_bin: "970423", account_no: "0123456789", account_name: "LE MINH HOANG" };

describe("accountQrPayload", () => {
  it("equals generateVietQr without amount", () => {
    const p = accountQrPayload(acc);
    expect(p).toBe(generateVietQr({ bankBin: "970423", account: "0123456789", name: "LE MINH HOANG" }));
    expect(p).toContain("010211");
    const d = decodeTlv(p);
    expect(d.ok && d.fields.has("54")).toBe(false);
  });
  it("round-trips through parseVietQr", () => {
    expect(parseVietQr(accountQrPayload(acc))).toMatchObject({
      kind: "vietqr",
      bankBin: "970423",
      account: "0123456789",
      name: "LE MINH HOANG",
      isDynamic: false,
    });
  });
});
