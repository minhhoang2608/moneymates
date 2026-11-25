import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCategoryRepository, createHandOffRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";

import type { PhotoPermission } from "../decide";
import { resetLeftoverSweepForTests, runLeftoverSweepOnce, sweepLeftoverQrImages } from "../sweepLeftovers";

const NOW = new Date("2026-06-10T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

async function setup(permission: PhotoPermission = { platform: "android", access: "read-write" }, autoDelete = true) {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-sw-")), "t.db")).db as unknown as AnyDb;
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
  const make = async (assetId: string, ageH: number) => {
    const h = await handOffs.create({
      transaction_id: tx.id,
      app_id: "tpb",
      method: "gallery",
      started_at: hoursAgo(ageH),
    });
    await handOffs.setQrAsset(h.id, assetId);
    return h;
  };
  const media = {
    deleteAssets: jest.fn(async (_ids: string[]) => true),
    getPermission: jest.fn(async () => permission),
  };
  const preferences = { getQrAutoDelete: jest.fn(async () => autoDelete) };
  const deps = { media, handOffs, preferences, now: () => NOW };
  return { handOffs, make, media, preferences, deps };
}

beforeEach(() => {
  resetLeftoverSweepForTests();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("sweepLeftoverQrImages", () => {
  it("deletes an image from a 25 h old hand-off and stamps it", async () => {
    const { handOffs, make, media, deps } = await setup();
    const h = await make("asset-25h", 25);
    await sweepLeftoverQrImages(deps);
    expect(media.deleteAssets).toHaveBeenCalledTimes(1);
    expect(media.deleteAssets).toHaveBeenCalledWith(["asset-25h"]);
    expect((await handOffs.get(h.id))?.qr_deleted_at).toBe(NOW.toISOString());
  });

  it("keeps recent images and deletes only the old one", async () => {
    const { handOffs, make, media, deps } = await setup();
    await make("old", 25);
    const recent = await make("new", 2);
    await sweepLeftoverQrImages(deps);
    expect(media.deleteAssets).toHaveBeenCalledWith(["old"]);
    expect((await handOffs.get(recent.id))?.qr_deleted_at).toBeNull();
  });

  it("makes no media call when nothing is pending or only recent images exist", async () => {
    const { make, media, deps } = await setup();
    await sweepLeftoverQrImages(deps);
    await make("new", 2);
    await sweepLeftoverQrImages(deps);
    expect(media.deleteAssets).not.toHaveBeenCalled();
    expect(media.getPermission).not.toHaveBeenCalled();
  });

  it.each(["rejects", "false"])("does not throw when deleteAssets %s, and retries next start", async (mode) => {
    const { handOffs, make, media, deps } = await setup();
    const h = await make("a", 30);
    media.deleteAssets.mockImplementationOnce(async () => {
      if (mode === "rejects") throw new Error("boom");
      return false;
    });
    await expect(sweepLeftoverQrImages(deps)).resolves.toEqual({ deleted: [] });
    expect((await handOffs.get(h.id))?.qr_deleted_at).toBeNull();
    await sweepLeftoverQrImages(deps);
    expect((await handOffs.get(h.id))?.qr_deleted_at).toBe(NOW.toISOString());
  });

  it("does not throw when the repository fails", async () => {
    const { deps } = await setup();
    deps.handOffs.listPendingQrImages = jest.fn(async () => {
      throw new Error("db");
    });
    await expect(sweepLeftoverQrImages(deps)).resolves.toEqual({ deleted: [] });
  });

  it("does nothing when auto-delete is off", async () => {
    const { make, media, deps } = await setup(undefined, false);
    await make("a", 30);
    await sweepLeftoverQrImages(deps);
    expect(media.getPermission).not.toHaveBeenCalled();
    expect(media.deleteAssets).not.toHaveBeenCalled();
  });

  it("skips when permission is add-only", async () => {
    const { make, media, deps } = await setup({ platform: "ios", access: "add-only" });
    await make("a", 30);
    await sweepLeftoverQrImages(deps);
    expect(media.deleteAssets).not.toHaveBeenCalled();
  });
});

describe("runLeftoverSweepOnce", () => {
  it("runs once per app start", async () => {
    const { make, media, deps } = await setup();
    await make("a", 30);
    await runLeftoverSweepOnce(deps);
    await make("b", 30);
    await runLeftoverSweepOnce(deps);
    expect(media.deleteAssets).toHaveBeenCalledTimes(1);
    resetLeftoverSweepForTests();
    await runLeftoverSweepOnce(deps);
    expect(media.deleteAssets).toHaveBeenCalledTimes(2);
  });
});
