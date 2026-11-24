import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createCategoryRepository,
  createHandOffRepository,
  createTransactionRepository,
} from "../../../db/repositories";
import type { AnyDb } from "../../../db/seed";
import { openTestDb } from "../../../db/testing/testDb";
import { recordQrImage, type RecordQrImageDeps } from "../record";

function deps(over: Partial<RecordQrImageDeps> = {}) {
  let on = true;
  const showToast = jest.fn();
  const setQrAsset = jest.fn(async () => null);
  const d: RecordQrImageDeps = {
    platform: "ios",
    handOffs: { setQrAsset },
    preferences: {
      getQrAutoDelete: async () => on,
      setQrAutoDelete: async (v) => {
        on = v;
      },
    },
    showToast,
    addOnlyMessage: "msg",
    ...over,
  };
  return { d, showToast, setQrAsset };
}

describe("recordQrImage", () => {
  it("does nothing for cache or none storage", async () => {
    const { d, setQrAsset } = deps();
    await recordQrImage(d, "h", { qrStorage: "cache" });
    await recordQrImage(d, "h", { qrStorage: "none" });
    expect(setQrAsset).not.toHaveBeenCalled();
  });

  it("stores the asset id in the real hand-off repo for album storage", async () => {
    const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-qr-")), "t.db")).db as unknown as AnyDb;
    const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
    const tx = await createTransactionRepository(db).create({
      type: "expense",
      amount: 1000,
      category_id: cat.id,
      note: "x",
      occurred_at: new Date().toISOString(),
      source: "qr",
    });
    const repo = createHandOffRepository(db);
    const row = await repo.create({ transaction_id: tx.id, app_id: "tcb", method: "share", started_at: new Date() });
    const { d } = deps({ handOffs: repo });
    await recordQrImage(d, row.id, { qrStorage: "album", qrAssetId: "a1", photoAccess: "read-write" });
    expect((await repo.get(row.id))?.qr_asset_id).toBe("a1");
  });

  it("add-only on iOS turns auto-delete off and toasts once", async () => {
    const { d, showToast, setQrAsset } = deps();
    const r = { qrStorage: "album", qrAssetId: "a1", photoAccess: "add-only" } as const;
    await recordQrImage(d, "h", r);
    await recordQrImage(d, "h", r);
    expect(setQrAsset).toHaveBeenCalledTimes(2);
    expect(await d.preferences.getQrAutoDelete()).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("msg");
  });

  it("read-write access keeps auto-delete on", async () => {
    const { d, showToast } = deps();
    await recordQrImage(d, "h", { qrStorage: "album", qrAssetId: "a1", photoAccess: "limited" });
    expect(await d.preferences.getQrAutoDelete()).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });
});
