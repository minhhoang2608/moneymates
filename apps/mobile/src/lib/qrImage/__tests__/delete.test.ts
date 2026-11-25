import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCategoryRepository, createHandOffRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";

import type { PhotoPermission } from "../decide";
import { createQrImageDeleter } from "../delete";

const NOW = new Date("2026-06-10T12:00:00.000Z");

async function setup(permission: PhotoPermission = { platform: "android", access: "read-write" }) {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-qd-")), "t.db")).db as unknown as AnyDb;
  const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
  const tx = await createTransactionRepository(db).create({
    type: "expense",
    amount: 1000,
    category_id: cat.id,
    note: "x",
    occurred_at: NOW.toISOString(),
    source: "qr",
  });
  const handOffs = createHandOffRepository(db);
  const make = async (assetId?: string) => {
    const h = await handOffs.create({ transaction_id: tx.id, app_id: "tpb", method: "gallery", started_at: NOW });
    if (assetId) await handOffs.setQrAsset(h.id, assetId);
    return h;
  };
  const media = {
    deleteAssets: jest.fn(async (_ids: string[]) => true),
    getPermission: jest.fn(async () => permission),
  };
  const spyList = jest.spyOn(handOffs, "listPendingQrImages");
  const deleter = createQrImageDeleter({ media, handOffs, now: () => NOW });
  return { handOffs, make, media, deleter, spyList };
}

describe("createQrImageDeleter", () => {
  it("android: deletes silently with one call and marks the row", async () => {
    const { handOffs, make, media, deleter } = await setup();
    const h = await make("asset-1");
    const r = await deleter.deletePendingOnReturn();
    expect(media.deleteAssets).toHaveBeenCalledTimes(1);
    expect(media.deleteAssets).toHaveBeenCalledWith(["asset-1"]);
    expect((await handOffs.get(h.id))?.qr_deleted_at).toBe(NOW.toISOString());
    expect(r.deleted).toEqual([h.id]);
  });

  it("ios: two pending hand-offs go in a single batch call", async () => {
    const { make, media, deleter } = await setup({ platform: "ios", access: "read-write" });
    await make("a1");
    await make("a2");
    await deleter.deletePendingOnReturn();
    expect(media.deleteAssets).toHaveBeenCalledTimes(1);
    expect(media.deleteAssets.mock.calls[0][0].sort()).toEqual(["a1", "a2"]);
  });

  it.each(["declined", "throws"])("%s: nothing is marked as deleted", async (mode) => {
    const { handOffs, make, media, deleter } = await setup({ platform: "ios", access: "read-write" });
    const h = await make("a1");
    if (mode === "declined") media.deleteAssets.mockResolvedValueOnce(false);
    else media.deleteAssets.mockRejectedValueOnce(new Error("denied"));
    const r = await deleter.deletePendingOnReturn();
    expect(r.deleted).toEqual([]);
    expect((await handOffs.get(h.id))?.qr_deleted_at).toBeNull();
  });

  it("ios add-only: does not even look for pending images", async () => {
    const { make, media, deleter, spyList } = await setup({ platform: "ios", access: "add-only" });
    await make("a1");
    await deleter.deletePendingOnReturn();
    expect(media.deleteAssets).not.toHaveBeenCalled();
    expect(spyList).not.toHaveBeenCalled();
  });

  it("skips deleted rows, rows without asset id and unknown ids; empty means no call", async () => {
    const { handOffs, make, media, deleter } = await setup();
    const done = await make("old");
    await handOffs.markQrDeleted(done.id, NOW);
    const none = await make();
    const r = await deleter.deleteQrImages([done.id, none.id, "missing"]);
    expect(r.deleted).toEqual([]);
    expect(media.deleteAssets).not.toHaveBeenCalled();
  });

  it("deleteQrImageForHandOff deletes only that one", async () => {
    const { make, media, deleter } = await setup();
    const a = await make("a1");
    await make("a2");
    await deleter.deleteQrImageForHandOff(a.id);
    expect(media.deleteAssets).toHaveBeenCalledWith(["a1"]);
  });
});
