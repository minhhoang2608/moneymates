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

  describe("enabled flag (#306)", () => {
    it("AC1: enabling vcb adds it, disabling removes it, count updates", async () => {
      const { db } = openTestDb();
      const repo = repoFor(db);
      await repo.setEnabledOrder(["mb", "tpb", "tcb", "momo"]);
      await tick();
      await repo.setEnabled("vcb", true);
      const list = await repo.getEnabledApps();
      expect(list).toEqual(["mb", "tpb", "tcb", "momo", "vcb"]);
      expect(list).toHaveLength(5);
      const before = (await db.select().from(paymentAppPrefs)).find((r) => r.app_key === "vcb")!;
      await tick();
      await repo.setEnabled("vcb", false);
      expect(await repo.getEnabledApps()).toEqual(["mb", "tpb", "tcb", "momo"]);
      const row = (await db.select().from(paymentAppPrefs)).find((r) => r.app_key === "vcb")!;
      expect(row.enabled).toBe(false);
      expect(row.deleted_at).toBeNull();
      expect(row.updated_at > before.updated_at).toBe(true);
    });

    it("AC2: enabled order survives reopen", async () => {
      const file = tmpDbFile();
      const a = openTestDb(file);
      await repoFor(a.db).setEnabledOrder(["momo", "mb", "tpb", "tcb"]);
      a.sqlite.close();
      const b = openTestDb(file);
      expect(await repoFor(b.db).getEnabledApps()).toEqual(["momo", "mb", "tpb", "tcb"]);
      b.sqlite.close();
    });

    it("AC2: keys left out are disabled and legacy tpbank is normalised", async () => {
      const { db } = openTestDb();
      const repo = repoFor(db);
      await repo.setEnabledOrder(["mb", "vcb", "momo"]);
      await repo.setEnabledOrder(["tpbank", "mb"]);
      expect(await repo.getEnabledApps()).toEqual(["tpb", "mb"]);
      const rows = await db.select().from(paymentAppPrefs);
      expect(rows.find((r) => r.app_key === "vcb")!.enabled).toBe(false);
    });

    it("AC3: fresh DB has not chosen", async () => {
      const { db } = openTestDb();
      const repo = repoFor(db);
      expect(await repo.hasChosen()).toBe(false);
      expect(await repo.getEnabledApps()).toEqual([]);
      await repo.setEnabled("vcb", false);
      expect(await repo.hasChosen()).toBe(true);
    });

    it("AC4: setAppOrder does not change enabled flags", async () => {
      const { db } = openTestDb();
      const repo = repoFor(db);
      await repo.setEnabledOrder(["mb", "momo"]);
      await repo.setEnabled("momo", false);
      await repo.setAppOrder(["momo", "mb"]);
      const rows = await db.select().from(paymentAppPrefs);
      expect(rows.find((r) => r.app_key === "momo")!.enabled).toBe(false);
      expect(rows.find((r) => r.app_key === "mb")!.enabled).toBe(true);
    });
  });
});
