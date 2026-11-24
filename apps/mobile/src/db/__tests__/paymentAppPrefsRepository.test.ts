import { createPaymentAppPrefsRepository } from "../repositories";
import { paymentAppPrefs } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";
import { tick, tmpDbFile } from "../testing/tmpFile";

const repoFor = (db: unknown) => createPaymentAppPrefsRepository(db as AnyDb);

describe("paymentAppPrefsRepository", () => {
  it("AC1: saved order survives close and reopen", async () => {
    const file = tmpDbFile();
    const a = openTestDb(file);
    await repoFor(a.db).setAppOrder(["tpb", "tcb", "momo", "vcb", "mb", "icb", "bidv", "acb", "ocb"]);
    await repoFor(a.db).setAppOrder(["momo", "tpb", "tcb", "vcb", "mb", "icb", "bidv", "acb", "ocb"]);
    a.sqlite.close();
    const b = openTestDb(file);
    expect(await repoFor(b.db).getAppOrder()).toEqual(["momo", "tpb", "tcb", "vcb", "mb", "icb", "bidv", "acb", "ocb"]);
    expect(await b.db.select().from(paymentAppPrefs)).toHaveLength(9);
    b.sqlite.close();
  });

  it("defaults to catalogue order, appends missing apps, ignores unknown keys", async () => {
    const { db } = openTestDb();
    const repo = repoFor(db);
    expect(await repo.getAppOrder()).toEqual(["tpb", "tcb", "vcb", "mb", "momo", "icb", "bidv", "acb", "ocb"]);
    await repo.setAppOrder(["momo", "unknown", "mb"]);
    expect(await repo.getAppOrder()).toEqual(["momo", "mb", "tpb", "tcb", "vcb", "icb", "bidv", "acb", "ocb"]);
  });

  it("bumps updated_at and revives soft-deleted rows", async () => {
    const { db } = openTestDb();
    const repo = repoFor(db);
    await repo.setAppOrder(["mb", "momo"]);
    const first = (await db.select().from(paymentAppPrefs)).find((r) => r.app_key === "mb")!;
    await tick();
    await repo.setAppOrder(["momo", "mb", "icb", "bidv", "acb", "ocb"]);
    const second = (await db.select().from(paymentAppPrefs)).find((r) => r.app_key === "mb")!;
    expect(second.id).toBe(first.id);
    expect(second.sort_order).toBe(1);
    expect(second.updated_at > first.updated_at).toBe(true);
  });
});
