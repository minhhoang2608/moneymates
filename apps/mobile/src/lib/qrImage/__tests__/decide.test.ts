import { autoDeleteAvailable, decideQrDeletion, decideQrHandOff, decideQrStorage } from "../decide";
import { vi } from "../../../i18n/vi";

const mb = { supportsAutofill: true };
const tpbank = { supportsAutofill: false };
const techcombank = { supportsAutofill: false };

describe("decideQrStorage", () => {
  it.each([
    ["ios", true],
    ["ios", false],
    ["android", true],
    ["android", false],
  ] as const)("autofill app (MB) needs no image: %s %s", (platform, bankAcceptsDirectShare) => {
    expect(decideQrStorage({ platform, app: mb, bankAcceptsDirectShare })).toBe("none");
  });

  it("android + known direct share still uses the album (bank apps offer to pay the newest gallery QR)", () => {
    expect(decideQrStorage({ platform: "android", app: tpbank, bankAcceptsDirectShare: true })).toBe("album");
  });

  it("android without direct share uses album", () => {
    expect(decideQrStorage({ platform: "android", app: techcombank, bankAcceptsDirectShare: false })).toBe("album");
  });

  it.each([true, false])("ios non-autofill always album (direct share %s)", (bankAcceptsDirectShare) => {
    expect(decideQrStorage({ platform: "ios", app: tpbank, bankAcceptsDirectShare })).toBe("album");
  });
});

describe("decideQrDeletion", () => {
  it("android silent, ios batch dialog", () => {
    expect(decideQrDeletion({ platform: "android" })).toBe("silent");
    expect(decideQrDeletion({ platform: "ios" })).toBe("batch-dialog");
  });
});

describe("autoDeleteAvailable", () => {
  it("false only for ios add-only", () => {
    expect(autoDeleteAvailable({ platform: "ios", access: "add-only" })).toBe(false);
    expect(autoDeleteAvailable({ platform: "ios", access: "read-write" })).toBe(true);
    expect(autoDeleteAvailable({ platform: "ios", access: "limited" })).toBe(true);
    expect(autoDeleteAvailable({ platform: "android", access: "read-write" })).toBe(true);
  });
});

describe("vi.qrImage", () => {
  it("has the add-only permission text", () => {
    expect(vi.qrImage.addOnlyPermission).toBe(
      "Chưa cho phép xoá ảnh. Vào Cài đặt > Ảnh, chọn quyền đọc và ghi để MoneyMates tự xoá ảnh QR tạm.",
    );
  });
});

describe("decideQrHandOff", () => {
  it.each(["qr_image", "no_image"] as const)("autofill app: no image, image method (%s)", (nonAutofillMode) => {
    expect(decideQrHandOff({ platform: "ios", app: mb, bankAcceptsDirectShare: false, nonAutofillMode })).toEqual({
      storage: "none",
      method: "image",
    });
  });

  it.each(["ios", "android"] as const)("no_image: no storage, paste (%s)", (platform) => {
    expect(
      decideQrHandOff({ platform, app: tpbank, bankAcceptsDirectShare: true, nonAutofillMode: "no_image" }),
    ).toEqual({ storage: "none", method: "paste" });
  });

  it("qr_image and the default always use the album", () => {
    const base = { platform: "android", app: tpbank } as const;
    expect(decideQrHandOff({ ...base, bankAcceptsDirectShare: true, nonAutofillMode: "qr_image" })).toEqual({
      storage: "album",
      method: "image",
    });
    expect(decideQrHandOff({ ...base, bankAcceptsDirectShare: false })).toEqual({
      storage: "album",
      method: "image",
    });
  });
});
