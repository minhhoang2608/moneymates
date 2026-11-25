import type { PayApp } from "../apps";
import { startHandOff, type StartHandOffDeps } from "../startHandOff";

const app = { id: "tpb", name: "TPBank" } as PayApp;
const model = { kind: "other", bankName: "", bankBin: "", account: "", payload: "x", isDynamic: false } as never;

function setup(result: object) {
  const create = jest.fn().mockResolvedValue({ id: "h2" });
  const setQrAsset = jest.fn().mockResolvedValue(undefined);
  const setShareResult = jest.fn().mockResolvedValue(undefined);
  const handOff = jest.fn().mockResolvedValue(result);
  const deps: StartHandOffDeps = {
    makeHandOff: () => handOff,
    handOffs: { create, setQrAsset },
    handOffMemory: { getShareMemory: async () => ({ tpb: "share_ok" as const }), setShareResult },
    record: {
      platform: "android",
      preferences: { getQrAutoDelete: async () => true, setQrAutoDelete: async () => {} },
      showToast: jest.fn(),
      addOnlyMessage: "m",
    },
  };
  return { deps, create, setQrAsset, setShareResult, handOff };
}
const args = { app, model, amount: 55000, note: "n", txId: "t1", getQrBase64: async () => null };

describe("startHandOff", () => {
  it("creates a hand-off row for the transaction and records the album asset", async () => {
    const s = setup({
      opened: true,
      mode: "direct",
      decision: "direct-share",
      share: "shared",
      qrStorage: "album",
      qrAssetId: "a1",
      photoAccess: "read-write",
    });
    const onRow = jest.fn();
    const res = await startHandOff(s.deps, { ...args, onRow });
    expect(res.opened).toBe(true);
    expect(s.handOff.mock.calls[0][1]).toMatchObject({ amount: 55000, knownResult: "share_ok" });
    expect(s.create).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_id: "t1", app_id: "tpb", started_at: expect.any(Date) }),
    );
    expect(onRow).toHaveBeenCalledWith("h2");
    expect(s.setQrAsset).toHaveBeenCalledWith("h2", "a1");
  });
  it("remembers a rejected share and stores nothing without a transaction", async () => {
    const s = setup({
      opened: true,
      mode: "direct",
      decision: "direct-share",
      share: "share_failed",
      qrStorage: "cache",
    });
    await startHandOff(s.deps, { ...args, txId: undefined });
    expect(s.create).not.toHaveBeenCalled();
    expect(s.setShareResult).toHaveBeenCalledWith("tpb", false);
  });
});
