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
const tpb = PAY_APPS.find((a) => a.id === "tpbank")!;
const mb = PAY_APPS.find((a) => a.id === "mb")!;

function setup(over: Partial<HandOffDeps> = {}) {
  const calls: string[] = [];
  const deps: HandOffDeps = {
    openUrl: jest.fn(async (u) => void calls.push(`open:${u}`)),
    setClipboard: jest.fn(async (t) => void calls.push(`clip:${t}`)),
    saveQrImage: jest.fn(async () => void calls.push("image")),
    ...over,
  };
  return { calls, deps, handOff: createHandOff(deps) };
}

describe("handOff", () => {
  it("VietQR: clipboard (account, amount, note) → image → open the scheme, in order", async () => {
    const tcb = PAY_APPS.find((x) => x.id === "tcb")!;
    const { calls, handOff } = setup();
    expect(await handOff(tcb, { model: vietqr, amount: 60000, note: "PHO" })).toEqual({ opened: true });
    expect(calls).toEqual(["clip:0123456789 60000 PHO", "image", "open:tcb://"]);
  });

  it("VietQR without note: clipboard has account and amount only", async () => {
    const { calls, handOff } = setup();
    await handOff(mb, { model: vietqr, amount: 55000, note: "" });
    expect(calls).toEqual(["clip:0123456789 55000", "image", "open:mbbank://"]);
  });

  it("image save fails → still opens", async () => {
    const { calls, handOff } = setup({
      saveQrImage: async () => {
        throw new Error("denied");
      },
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(await handOff(mb, { model: vietqr, amount: 1, note: "" })).toEqual({ opened: true });
    expect(calls).toContain("open:mbbank://");
  });

  it("non-VietQR: saves image, opens app, no clipboard", async () => {
    const { calls, deps, handOff } = setup();
    await handOff(tpb, { model: other, amount: 1, note: "" });
    expect(calls).toEqual(["image", "open:hydro://"]);
    expect(deps.setClipboard).not.toHaveBeenCalled();
  });

  it("openUrl throws → resolves {opened:false}", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, handOff } = setup({
      openUrl: async () => {
        throw new Error("no app");
      },
    });
    expect(await handOff(tpb, { model: vietqr, amount: 1, note: "" })).toEqual({ opened: false });
    expect(deps.setClipboard).toHaveBeenCalled();
    expect(deps.saveQrImage).toHaveBeenCalled();
  });
});
