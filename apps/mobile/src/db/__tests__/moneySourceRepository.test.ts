import { eq } from "drizzle-orm";

import { DEFAULT_MONEY_SOURCES } from "../../lib/preferences/defaults";
import { createMoneySourceRepository, createTransactionRepository } from "../repositories";
import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { moneySources, transactions } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";
import { tick } from "../testing/tmpFile";

const setup = () => {
  const { db, sqlite } = openTestDb();
  return { db, sqlite, repo: createMoneySourceRepository(db as unknown as AnyDb) };
};
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code: string }).code;
  }
  return null;
};

describe("moneySourceRepository", () => {
  it("seeds the four defaults first", async () => {
    const { repo } = setup();
    const list = await repo.listSources();
    expect(list.map((s) => s.name)).toEqual(DEFAULT_MONEY_SOURCES.map((s) => s.name));
    expect(list.map((s) => s.id)).toEqual(DEFAULT_MONEY_SOURCES.map((s) => s.id));
  });

  it("AC2: addSource appears in listSources after the defaults", async () => {
    const { repo } = setup();
    await repo.addSource("  Visa ", "card");
    const list = await repo.listSources();
    expect(list).toHaveLength(5);
    expect(list[4]).toMatchObject({ name: "Visa", kind: "card", is_default: false });
  });

  it("rejects empty names and invalid kinds, renames and bumps updated_at", async () => {
    const { repo } = setup();
    expect(await codeOf(repo.addSource("   ", "cash"))).toBe("name_required");
    expect(await codeOf(repo.addSource("X", "crypto" as never))).toBe("invalid_kind");
    const added = await repo.addSource("Visa", "card");
    await tick();
    const renamed = await repo.renameSource(added.id, "Visa Debit");
    expect(renamed.name).toBe("Visa Debit");
    expect(renamed.updated_at > added.updated_at).toBe(true);
    expect(await codeOf(repo.renameSource(added.id, ""))).toBe("name_required");
    expect(await codeOf(repo.renameSource("missing", "A"))).toBe("not_found");
  });

  it("AC3: deleteSource soft deletes and leaves transactions untouched", async () => {
    const { db, repo } = setup();
    const txRepo = createTransactionRepository(db as unknown as AnyDb);
    const food = DEFAULT_CATEGORIES.find((c) => c.name === "Ăn uống")!.id;
    const src = await repo.addSource("Visa", "card");
    const tx = await txRepo.create({
      type: "expense",
      amount: 50000,
      category_id: food,
      occurred_at: "2026-11-05T05:00:00Z",
      money_source: "Visa",
    });
    const before = (await db.select().from(transactions).where(eq(transactions.id, tx.id)))[0];
    await tick();
    await repo.deleteSource(src.id);
    expect((await repo.listSources()).map((s) => s.name)).not.toContain("Visa");
    const row = (await db.select().from(moneySources).where(eq(moneySources.id, src.id)))[0];
    expect(row.deleted_at).not.toBeNull();
    const after = (await db.select().from(transactions).where(eq(transactions.id, tx.id)))[0];
    expect(after).toEqual(before);
    expect(after.money_source).toBe("Visa");
    expect(after.deleted_at).toBeNull();
  });
});
