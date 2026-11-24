import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decideHandOff } from "../../lib/payConfirm/decideHandOff";
import { PAY_APPS } from "../../lib/payConfirm/apps";
import { knownResultFor } from "../../lib/payConfirm/shareMemory";
import {
  createCategoryRepository,
  createHandOffMemoryRepository,
  createHandOffRepository,
  createTransactionRepository,
} from "../repositories";
import { handOffs } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const start = new Date("2026-01-01T10:00:00.000Z");
const at = (ms: number) => new Date(start.getTime() + ms);

async function setup() {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-ho-")), "t.db")).db as unknown as AnyDb;
  const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
  const tx = await createTransactionRepository(db).create({
    type: "expense",
    amount: 1000,
    category_id: cat.id,
    note: "x",
    occurred_at: start.toISOString(),
    source: "qr",
  });
  const repo = createHandOffRepository(db);
  const make = (method: "share" | "autofill" = "autofill", app_id = "mb") =>
    repo.create({ transaction_id: tx.id, app_id, method, started_at: start });
  return { db, repo, make, memory: createHandOffMemoryRepository(db) };
}

describe("handOffRepository", () => {
  it("marks time after 75 s, not after 20 s", async () => {
    const { repo, make } = await setup();
    const a = await make();
    const ra = await repo.recordReturn(a.id, at(75_000));
    expect(ra?.paid_signal).toBe("time");
    expect(ra?.returned_at).toBe(at(75_000).toISOString());
    const b = await make();
    const rb = await repo.recordReturn(b.id, at(20_000));
    expect(rb?.paid_signal).toBeNull();
    expect(rb?.returned_at).toBe(at(20_000).toISOString());
  });

  it("first signal wins", async () => {
    const { repo, make } = await setup();
    const a = await make();
    await repo.recordReturn(a.id, at(20_000));
    expect(await repo.markPaid(a.id, "notification")).toBe(true);
    expect(await repo.markPaid(a.id, "receipt")).toBe(false);
    expect((await repo.get(a.id))?.paid_signal).toBe("notification");
    await repo.recordReturn(a.id, at(90_000));
    expect((await repo.get(a.id))?.paid_signal).toBe("notification");
    const b = await make();
    expect(await repo.markPaid(b.id, "receipt")).toBe(true);
    expect(await repo.markPaid(b.id, "time")).toBe(false);
  });

  it("ignores soft-deleted rows", async () => {
    const { db, repo, make } = await setup();
    const a = await make();
    await db.update(handOffs).set({ deleted_at: new Date().toISOString() });
    expect(await repo.markPaid(a.id, "time")).toBe(false);
    expect(await repo.recordReturn(a.id, at(90_000))).toBeNull();
  });

  it("remembers share_ok from the paid signal for share hand-offs only", async () => {
    const { repo, make, memory } = await setup();
    const s = await make("share", "tpb");
    await repo.markPaid(s.id, "time");
    const mem = await memory.getShareMemory();
    expect(mem).toEqual({ tpb: "share_ok" });
    const app = PAY_APPS.find((a) => a.id === "tpb");
    expect(app && decideHandOff(app, "android", knownResultFor(mem, "tpb"))).toBe("direct-share");
    const p = await make("autofill", "mb");
    await repo.markPaid(p.id, "time");
    expect(await memory.getShareMemory()).toEqual({ tpb: "share_ok" });
  });

  describe("QR image tracking", () => {
    it("setQrAsset makes the hand-off pending, markQrDeleted removes it", async () => {
      const { repo, make } = await setup();
      const a = await make();
      const set = await repo.setQrAsset(a.id, "asset-1");
      expect(set?.qr_asset_id).toBe("asset-1");
      expect((await repo.listPendingQrImages()).map((r) => r.id)).toEqual([a.id]);
      const when = at(5_000);
      const done = await repo.markQrDeleted(a.id, when);
      expect(done?.qr_deleted_at).toBe(when.toISOString());
      expect(await repo.listPendingQrImages()).toEqual([]);
    });

    it("bumps updated_at on both writes", async () => {
      const { repo, make, db } = await setup();
      const a = await make();
      const old = "2020-01-01T00:00:00.000Z";
      await db.update(handOffs).set({ updated_at: old });
      expect((await repo.setQrAsset(a.id, "x"))?.updated_at).not.toBe(old);
      await db.update(handOffs).set({ updated_at: old });
      expect((await repo.markQrDeleted(a.id))?.updated_at).not.toBe(old);
    });

    it("markQrDeleted twice keeps the first time", async () => {
      const { repo, make } = await setup();
      const a = await make();
      await repo.setQrAsset(a.id, "x");
      await repo.markQrDeleted(a.id, at(1_000));
      const r = await repo.markQrDeleted(a.id, at(9_000));
      expect(r?.qr_deleted_at).toBe(at(1_000).toISOString());
    });

    it("hand-offs without an image, or soft-deleted, are never pending", async () => {
      const { repo, make, db } = await setup();
      await make("autofill");
      await make("share", "tpb");
      expect(await repo.listPendingQrImages()).toEqual([]);
      const c = await make();
      await repo.setQrAsset(c.id, "x");
      await db.update(handOffs).set({ deleted_at: new Date().toISOString() });
      expect(await repo.listPendingQrImages()).toEqual([]);
      expect(await repo.setQrAsset(c.id, "y")).toBeNull();
      expect(await repo.markQrDeleted(c.id)).toBeNull();
      expect(await repo.setQrAsset("missing", "y")).toBeNull();
    });
  });
});
