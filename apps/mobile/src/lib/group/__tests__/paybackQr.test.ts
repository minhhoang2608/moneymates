import { buildPaybackQr } from "../paybackQr";
import { generateVietQr, parseVietQr } from "@/lib/vietqr";

const account = {
  bank_bin: "970423",
  bank_name: "TPBank",
  account_no: "0123456789",
  account_name: "HOANG LE",
  deleted_at: null,
};

describe("buildPaybackQr", () => {
  it("member QR carries amount and '<Nhóm> <Tên>' message", () => {
    const r = buildPaybackQr({ groupName: "Đà Lạt", account, memberName: "An", amount: 400000 });
    if (r.kind !== "qr") throw new Error("expected qr");
    expect(r.payload).toBe(
      generateVietQr({
        bankBin: "970423",
        account: "0123456789",
        name: "HOANG LE",
        amount: 400000,
        message: "Đà Lạt An",
      }),
    );
    expect(r.amount).toBe(400000);
    expect(r.message).toBe("Da Lat An");
    const parsed = parseVietQr(r.payload);
    expect(parsed.kind === "vietqr" && parsed.amount).toBe(400000);
    expect(parsed.kind === "vietqr" && parsed.message).toBe("Da Lat An");
  });

  it("truncates long group names and keeps the member name", () => {
    const r = buildPaybackQr({
      groupName: "Chuyến đi Đà Lạt cuối năm của cả nhóm",
      account,
      memberName: "An",
      amount: 1000,
    });
    if (r.kind !== "qr") throw new Error("expected qr");
    expect(r.message.length).toBeLessThanOrEqual(25);
    expect(r.message.endsWith(" An")).toBe(true);
  });

  it("QR chung is static: no amount, group name message", () => {
    const r = buildPaybackQr({ groupName: "Đà Lạt", account });
    if (r.kind !== "qr") throw new Error("expected qr");
    expect(r.amount).toBeNull();
    expect(r.message).toBe("Da Lat");
    expect(r.payload).toContain("010211");
    expect(r.payload).not.toContain("5406");
  });

  it("reports no_account for a missing or deleted account", () => {
    expect(buildPaybackQr({ groupName: "G", account: null })).toEqual({ kind: "no_account" });
    expect(buildPaybackQr({ groupName: "G", account: { ...account, deleted_at: "2026-01-01T00:00:00Z" } })).toEqual({
      kind: "no_account",
    });
  });

  it("exposes the bank BIN for the image template", () => {
    const r = buildPaybackQr({ groupName: "Đà Lạt", account, memberName: "An", amount: 400000 });
    expect(r.kind === "qr" && r.bankBin).toBe("970423");
  });
});
