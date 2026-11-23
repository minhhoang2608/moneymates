import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { createPreferencesRepository, createTransactionRepository } from "../repositories";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";
import { tmpDbFile } from "../testing/tmpFile";

describe("preferencesRepository", () => {
  it("AC4: default currency is VND and transactions store VND", async () => {
    const { db } = openTestDb();
    const repo = createPreferencesRepository(db as unknown as AnyDb);
    expect(await repo.getDefaultCurrency()).toBe("VND");
    const food = DEFAULT_CATEGORIES.find((c) => c.name === "Ăn uống")!.id;
    const tx = await createTransactionRepository(db as unknown as AnyDb).create({
      type: "expense",
      amount: 1000,
      category_id: food,
      occurred_at: "2026-11-05T05:00:00Z",
    });
    expect(tx.currency).toBe("VND");
  });

  it("rejects an invalid currency code", async () => {
    const { db } = openTestDb();
    const repo = createPreferencesRepository(db as unknown as AnyDb);
    await expect(repo.setDefaultCurrency("dong!")).rejects.toMatchObject({ code: "invalid_currency" });
    await repo.setDefaultCurrency("vnd");
    expect(await repo.getDefaultCurrency()).toBe("VND");
  });

  it("AC5: alert toggle defaults to true and persists across reopen", async () => {
    const file = tmpDbFile();
    const a = openTestDb(file);
    expect(await createPreferencesRepository(a.db as unknown as AnyDb).getAlertOverLastMonth()).toBe(true);
    await createPreferencesRepository(a.db as unknown as AnyDb).setAlertOverLastMonth(false);
    a.sqlite.close();
    const b = openTestDb(file);
    const repo = createPreferencesRepository(b.db as unknown as AnyDb);
    expect(await repo.getAlertOverLastMonth()).toBe(false);
    await repo.setAlertOverLastMonth(true);
    expect(await repo.getAlertOverLastMonth()).toBe(true);
    b.sqlite.close();
  });
});

describe("preferencesRepository app lock", () => {
  it("defaults to false and round-trips", async () => {
    const { db } = openTestDb();
    const repo = createPreferencesRepository(db as unknown as AnyDb);
    expect(await repo.getAppLockEnabled()).toBe(false);
    await repo.setAppLockEnabled(true);
    expect(await repo.getAppLockEnabled()).toBe(true);
    await repo.setAppLockEnabled(false);
    expect(await repo.getAppLockEnabled()).toBe(false);
  });
});
