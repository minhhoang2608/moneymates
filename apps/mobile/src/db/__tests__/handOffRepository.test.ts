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
});
