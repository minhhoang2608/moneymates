import { generateVietQr } from "@/lib/vietqr";

import { formatDetailDateTime, qrDetails } from "../detail";

describe("formatDetailDateTime", () => {
  it("formats in Vietnam local time", () => {
    expect(formatDetailDateTime("2026-11-21T07:02:00Z")).toBe("21/11/2026, 14:02");
  });
  it("rolls over the day at UTC+7", () => {
    expect(formatDetailDateTime("2026-11-21T18:30:00Z")).toBe("22/11/2026, 01:30");
  });
});

describe("qrDetails", () => {
  it("extracts payee, bank and message from a VietQR payload", () => {
    const qr = generateVietQr({ bankBin: "970436", account: "0123456789", name: "KS DALAT", message: "DAT PHONG" });
    expect(qrDetails(qr)).toEqual({ payee: "KS DALAT · 0123456789", bank: "Vietcombank", message: "DAT PHONG" });
  });
  it("returns null for null, empty and invalid payloads", () => {
    expect(qrDetails(null)).toBeNull();
    expect(qrDetails("")).toBeNull();
    expect(qrDetails("not a qr")).toBeNull();
  });
});
