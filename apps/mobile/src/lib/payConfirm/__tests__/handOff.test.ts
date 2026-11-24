import { PAY_APPS } from "../apps";
import { createHandOff, type HandOffDeps } from "../handOff";
import type { PayConfirmModel } from "../params";

const vietqr: PayConfirmModel = {
  kind: "vietqr",
  bankName: "TPBank",
  bankBin: "970423",
  account: "0123456789",
  amount: 55000,
  isDynamic: true,
  payload: "x",
};
const other: PayConfirmModel = {
  kind: "other",
  bankName: "",
  bankBin: "",
  account: "",
  isDynamic: false,
  payload: "y",
};
const tpb = PAY_APPS.find((a) => a.id === "tpb")!;
const mb = PAY_APPS.find((a) => a.id === "mb")!;

function setup(over: Partial<HandOffDeps> = {}) {
  const calls: string[] = [];
  const deps: HandOffDeps = {
    platform: "android",
    openIntent: jest.fn(async (u) => void calls.push(`intent:${u}`)),
    shareToPackage: jest.fn(async (p) => void calls.push(`share:${p}`)),
    openUrl: jest.fn(async (u) => void calls.push(`open:${u}`)),
    setClipboard: jest.fn(async (t) => void calls.push(`clip:${t}`)),
    saveQrImage: jest.fn(async () => {
      calls.push("image");
      return { assetId: "a1", access: "read-write" as const };
    }),
    ...over,
  };
  return { calls, deps, handOff: createHandOff(deps) };
}

const TCB_INTENT = "intent://#Intent;package=vn.com.techcombank.bb.app;end";
const tcb = PAY_APPS.find((x) => x.id === "tcb")!;

describe("handOff", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));

  it("android direct-share: bare account → album image → share to the package, no open", async () => {
    const { calls, handOff } = setup();
    expect(await handOff(tcb, { model: vietqr, amount: 60000, note: "PHO" })).toMatchObject({
      opened: true,
      mode: "direct",
      decision: "direct-share",
      share: "shared",
    });
    expect(calls).toEqual(["clip:0123456789", "image", "share:vn.com.techcombank.bb.app"]);
  });

  it("share throws → opens the app by intent, share_failed", async () => {
    const { calls, handOff } = setup({
      shareToPackage: async () => {
        throw new Error("no image/png handler");
      },
    });
    expect(await handOff(tcb, { model: vietqr, amount: 1, note: "" })).toMatchObject({
      opened: true,
      mode: "direct",
      decision: "direct-share",
      share: "share_failed",
    });
    expect(calls).toEqual(["clip:0123456789", "image", `intent:${TCB_INTENT}`]);
  });

  it("remembered share_failed → open-only through the intent", async () => {
    const { calls, deps, handOff } = setup();
    const res = await handOff(tcb, { model: vietqr, amount: 1, note: "", knownResult: "share_failed" });
    expect(res).toMatchObject({ opened: true, mode: "direct", decision: "open-only" });
    expect(deps.shareToPackage).not.toHaveBeenCalled();
    expect(calls).toEqual(["clip:0123456789", "image", `intent:${TCB_INTENT}`]);
  });

  it("ios non-autofill: open-only with the scheme", async () => {
    const { calls, deps, handOff } = setup({ platform: "ios" });
    const res = await handOff(tcb, { model: vietqr, amount: 1, note: "" });
    expect(res).toMatchObject({ opened: true, mode: "direct", decision: "open-only" });
    expect(calls).toEqual(["clip:0123456789", "image", "open:tcb://"]);
    expect(deps.shareToPackage).not.toHaveBeenCalled();
  });

  it("autofill app: opens dl.vietqr.io with the confirmed values, no clipboard or image", async () => {
    const { calls, deps, handOff } = setup();
    const res = await handOff(mb, { model: vietqr, amount: 70000, note: "Cafe" });
    expect(res).toEqual({ opened: true, mode: "autofill", decision: "autofill-link", qrStorage: "none" });
    expect(res.qrAssetId).toBeUndefined();
    expect(calls).toEqual([
      "open:https://dl.vietqr.io/pay?app=mb&ba=0123456789%40tpb&am=70000&tn=Cafe&url=https%3A%2F%2Fwww.vietqr.io",
    ]);
    expect(deps.setClipboard).not.toHaveBeenCalled();
    expect(deps.saveQrImage).not.toHaveBeenCalled();
  });

  it("autofill app with a non-VietQR code falls back to direct share", async () => {
    const { calls, handOff } = setup();
    const res = await handOff(mb, { model: other, amount: 1, note: "" });
    expect(res).toMatchObject({ opened: true, mode: "direct", decision: "direct-share", share: "shared" });
    expect(calls).toEqual(["image", "share:com.mbmobile"]);
  });

  it("image save fails → still shares", async () => {
    const { calls, handOff } = setup({
      saveQrImage: async () => {
        throw new Error("denied");
      },
    });
    expect(await handOff(tpb, { model: vietqr, amount: 1, note: "" })).toMatchObject({ opened: true });
    expect(calls).toContain("share:com.tpb.mb.gprsandroid");
  });

  it("non-VietQR: saves image, no clipboard", async () => {
    const { deps, handOff } = setup();
    await handOff(tpb, { model: other, amount: 1, note: "" });
    expect(deps.saveQrImage).toHaveBeenCalled();
    expect(deps.setClipboard).not.toHaveBeenCalled();
  });

  it("launch intent fails → falls back to the scheme, then the VietQR link", async () => {
    const opened: string[] = [];
    const { handOff } = setup({
      shareToPackage: async () => {
        throw new Error("x");
      },
      openIntent: async () => {
        throw new Error("package not visible");
      },
      openUrl: async (u) => {
        opened.push(u);
        if (u === "tcb://") throw new Error("no handler");
      },
    });
    expect(await handOff(tcb, { model: vietqr, amount: 1, note: "" })).toMatchObject({
      opened: true,
      share: "share_failed",
    });
    expect(opened).toEqual(["tcb://", "https://dl.vietqr.io/pay?app=tcb"]);
  });

  it("share and every open fail → resolves {opened:false}, clipboard and image still done", async () => {
    const { deps, handOff } = setup({
      shareToPackage: async () => {
        throw new Error("x");
      },
      openIntent: async () => {
        throw new Error("not installed");
      },
      openUrl: async () => {
        throw new Error("no handler");
      },
    });
    expect(await handOff(tpb, { model: vietqr, amount: 1, note: "" })).toMatchObject({
      opened: false,
      share: "share_failed",
    });
    expect(deps.setClipboard).toHaveBeenCalledWith("0123456789");
    expect(deps.saveQrImage).toHaveBeenCalled();
  });

  it("open-only open throws → {opened:false}", async () => {
    const { handOff } = setup({
      platform: "ios",
      openUrl: async () => {
        throw new Error("no app");
      },
    });
    expect(await handOff(tpb, { model: vietqr, amount: 1, note: "" })).toMatchObject({ opened: false });
  });

  it("known direct share on Android uses the private cache: no album save, no asset id", async () => {
    const { calls, deps, handOff } = setup();
    const res = await handOff(tpb, { model: vietqr, amount: 1, note: "", knownResult: "share_ok" });
    expect(res).toMatchObject({ qrStorage: "cache", share: "shared" });
    expect(res.qrAssetId).toBeUndefined();
    expect(deps.saveQrImage).not.toHaveBeenCalled();
    expect(calls).toContain("share:com.tpb.mb.gprsandroid");
  });

  it("unknown share result saves to the album and returns the asset id", async () => {
    const { deps, handOff } = setup();
    const res = await handOff(tcb, { model: vietqr, amount: 1, note: "" });
    expect(deps.saveQrImage).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ qrStorage: "album", qrAssetId: "a1", photoAccess: "read-write" });
  });
});
