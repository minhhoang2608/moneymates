import { eq } from "drizzle-orm";

import { createQrImageDeleter } from "../../qrImage/delete";
import {
  createCategoryRepository,
  createHandOffMemoryRepository,
  createHandOffRepository,
  createPaymentAppPrefsRepository,
  createPreferencesRepository,
  createTransactionRepository,
} from "../../../db/repositories";
import { handOffs } from "../../../db/schema";
import type { AnyDb } from "../../../db/seed";
import { openTestDb } from "../../../db/testing/testDb";
import { e2eQr } from "../../../e2e/fixtures";
import { createBankNotificationSubscriber } from "../subscriber";

const start = new Date("2026-01-01T10:00:00.000Z");
const at = (ms: number) => start.getTime() + ms;
const TPB = "com.tpb.mb.gprsandroid";
const VCB = "com.VCB";
const debit = (amount = "55,000", sign = "-") => ({
  packageName: TPB,
  title: "TPBank",
  text: `TK ...6789 ${sign}${amount} VND lúc 12:03 24/11. ND: PHO 24`,
  postedAt: 0,
});

async function setup(
  opts: { enabled?: string[]; method?: "share" | "gallery"; app_id?: string; amount?: number } = {},
) {
  const db = openTestDb().db as unknown as AnyDb;
  const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
  const tx = await createTransactionRepository(db).create({
    type: "expense",
    amount: opts.amount ?? 55000,
    category_id: cat.id,
    note: "x",
    occurred_at: start.toISOString(),
    source: "qr",
    qr_data: e2eQr.dynamic,
  });
  const repo = createHandOffRepository(db);
  const memory = createHandOffMemoryRepository(db);
  const preferences = createPreferencesRepository(db);
  const paymentAppPrefs = createPaymentAppPrefsRepository(db);
  await preferences.setAutoDetectTransfers(true);
  await paymentAppPrefs.setEnabledOrder(opts.enabled ?? ["tpb", "vcb"]);
  const h = await repo.create({
    transaction_id: tx.id,
    app_id: opts.app_id ?? "tpb",
    method: (opts.method ?? "gallery") as "share",
    started_at: start,
  });
  await repo.setQrAsset(h.id, "asset-1");
  const unsub = jest.fn();
  const listener = { subscribe: jest.fn(() => unsub), isAccessGranted: jest.fn(async () => true) };
  let clock = at(3 * 60_000);
  const sub = createBankNotificationSubscriber({
    listener,
    preferences,
    paymentAppPrefs,
    handOffs: repo,
    now: () => clock,
  });
  await sub.sync();
  return { db, repo, memory, preferences, listener, unsub, sub, h, setNow: (t: number) => (clock = t) };
}

const row = async (db: AnyDb, id: string) => (await db.select().from(handOffs).where(eq(handOffs.id, id)))[0];

describe("bank notification subscriber", () => {
  it("marks a 55000 hand-off paid with signal notification 3 min later and keeps the QR image for deletion", async () => {
    const { db, repo, sub, h } = await setup();
    const res = await sub.handle({ ...debit(), postedAt: at(3 * 60_000) });
    expect(res).toBe(h.id);
    expect((await repo.get(h.id))?.paid_signal).toBe("notification");
    expect((await repo.listPendingQrImages()).map((r) => r.id)).toContain(h.id);
    const media = { deleteAssets: jest.fn(async () => true), getPermission: jest.fn(async () => "granted" as never) };
    const r = await createQrImageDeleter({ media, handOffs: repo }).deletePendingOnReturn();
    expect(r.deleted).toContain(h.id);
    expect((await row(db, h.id)).qr_deleted_at).not.toBeNull();
  });

  it.each([
    ["40 min late", debit(), 40 * 60_000],
    ["wrong amount", debit("54,000"), 3 * 60_000],
    ["incoming", debit("55,000", "+"), 3 * 60_000],
  ])("ignores %s", async (_n, n, delay) => {
    const { db, sub, h, setNow } = await setup();
    setNow(at(delay));
    const before = await row(db, h.id);
    expect(await sub.handle({ ...n, postedAt: at(delay) })).toBeNull();
    const after = await row(db, h.id);
    expect(after.paid_signal).toBeNull();
    expect(after.updated_at).toBe(before.updated_at);
  });

  it("subscribes only to enabled apps and ignores disabled ones", async () => {
    const { listener, db, sub, h } = await setup({ enabled: ["tpb"] });
    const pkgs = (listener.subscribe.mock.calls[0] as unknown as [unknown, string[]])[1];
    expect(pkgs).toContain(TPB);
    expect(pkgs).not.toContain(VCB);
    expect(
      await sub.handle({
        packageName: VCB,
        title: "VCB",
        text: "SD TK -55,000 VND ND: PHO 24",
        postedAt: at(3 * 60_000),
      }),
    ).toBeNull();
    expect((await row(db, h.id)).paid_signal).toBeNull();
  });

  it("remembers that a share hand-off worked; gallery leaves memory unchanged", async () => {
    const a = await setup({ method: "share" });
    await a.sub.handle({ ...debit(), postedAt: at(3 * 60_000) });
    expect((await a.memory.getShareMemory())["tpb"]).toBeDefined();
    const b = await setup({ method: "gallery" });
    await b.sub.handle({ ...debit(), postedAt: at(3 * 60_000) });
    expect(await b.memory.getShareMemory()).toEqual({});
  });

  it("stores, logs and sends nothing from the notification", async () => {
    const { db, sub } = await setup();
    const fetchSpy = jest.fn();
    (global as { fetch?: unknown }).fetch = fetchSpy;
    const spies = (["log", "warn", "error", "info"] as const).map((k) => jest.spyOn(console, k).mockImplementation());
    await sub.handle({ ...debit(), title: "SECRET-TITLE", postedAt: at(3 * 60_000) });
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toMatch(/SECRET-TITLE|PHO 24|55,000/);
    const dump = JSON.stringify(await db.select().from(handOffs));
    expect(dump).not.toMatch(/SECRET-TITLE|55,000/);
    spies.forEach((s) => s.mockRestore());
  });

  it("unsubscribes when the setting turns off", async () => {
    const { sub, preferences, unsub } = await setup();
    await preferences.setAutoDetectTransfers(false);
    await sub.sync();
    expect(unsub).toHaveBeenCalled();
  });

  it("stop unsubscribes", async () => {
    const { sub, unsub } = await setup();
    sub.stop();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
