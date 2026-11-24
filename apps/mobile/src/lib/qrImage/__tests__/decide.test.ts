import { autoDeleteAvailable, decideQrDeletion, decideQrStorage } from "../decide";
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

  it("android + direct share uses cache", () => {
    expect(decideQrStorage({ platform: "android", app: tpbank, bankAcceptsDirectShare: true })).toBe("cache");
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
