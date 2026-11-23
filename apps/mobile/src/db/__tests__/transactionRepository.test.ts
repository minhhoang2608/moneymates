import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { TransactionError } from "../../lib/transaction/types";
import { createTransactionRepository } from "../repositories";
import type { NewTransaction } from "../repositories";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const original = global.fetch;
const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const food = DEFAULT_CATEGORIES.find((c) => c.name === "Ăn uống")!.id;
const move = DEFAULT_CATEGORIES.find((c) => c.name === "Di chuyển")!.id;
const salary = DEFAULT_CATEGORIES.find((c) => c.name === "Lương")!.id;

const setup = (file = ":memory:") => {
  const { db, sqlite } = openTestDb(file);
  return { db, sqlite, repo: createTransactionRepository(db as unknown as AnyDb) };
};
const base: NewTransaction = { type: "expense", amount: 50000, category_id: food, occurred_at: "2026-11-05T05:00:00Z" };
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as TransactionError).code;
  }
  return null;
};
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-tx-")), "t.db");
const tick = () => new Promise((r) => setTimeout(r, 3));

describe("transaction repository", () => {
  it("AC1: persists across close and reopen", async () => {
    const file = tmpFile();
    const a = setup(file);
    const created = await a.repo.create({ ...base, note: "phở" });
    a.sqlite.close();
    const b = setup(file);
    const row = await b.repo.getById(created.id);
    expect(row).toEqual(created);
    expect(row?.amount).toBe(50000);
    expect(row?.currency).toBe("VND");
    expect(row?.category_id).toBe(food);
    b.sqlite.close();
  });

  it("AC2: rejects non-positive or non-integer amounts", async () => {
    const { repo, sqlite } = setup();
    for (const amount of [0, -1, 1.5, NaN, Infinity, "50000" as unknown as number]) {
      expect(await code(repo.create({ ...base, amount }))).toBe("invalid_amount");
    }
    const ok = await repo.create(base);
    for (const amount of [0, -1, 1.5, NaN, Infinity, "50000" as unknown as number]) {
      expect(await code(repo.update(ok.id, { amount }))).toBe("invalid_amount");
    }
    expect(() =>
      sqlite
        .prepare(
          "insert into transactions (id,created_at,updated_at,type,amount,category_id,occurred_at) values ('x','a','a','expense',0,?, 'a')",
        )
        .run(food),
    ).toThrow(/CHECK/i);
  });

  it("AC3: soft delete hides, restore brings back unchanged", async () => {
    const { repo } = setup();
    const row = await repo.create({ ...base, note: "phở" });
    await repo.softDelete(row.id);
    expect(await repo.getById(row.id)).toBeNull();
    expect(await repo.list()).toHaveLength(0);
    await repo.restore(row.id);
    const [back] = await repo.list();
    expect({ ...back, updated_at: "", deleted_at: null }).toEqual({ ...row, updated_at: "", deleted_at: null });
    expect(back.deleted_at).toBeNull();
    expect(await code(repo.softDelete("nope"))).toBe("not_found");
    expect(await code(repo.restore("nope"))).toBe("not_found");
  });

  it("AC4: list filters, search and ordering", async () => {
    const { repo } = setup();
    const mk = (o: Partial<NewTransaction>) => repo.create({ ...base, ...o });
    await mk({ occurred_at: "2026-10-31T23:59:59.999Z", note: "Oct" });
    await mk({ occurred_at: "2026-11-01T00:00:00.000Z", note: "Phở bò" });
    await mk({ occurred_at: "2026-11-10T00:00:00.000Z", note: "phở bò", money_source: "Techcombank" });
    await mk({ occurred_at: "2026-11-15T00:00:00.000Z", note: "pho", category_id: move });
    await mk({ occurred_at: "2026-11-20T00:00:00.000Z", type: "income", category_id: salary, note: "lương" });
    await mk({ occurred_at: "2026-12-01T00:00:00.000Z", note: "Dec" });

    const month = { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z" };
    const all = await repo.list(month);
    expect(all.map((r) => r.note)).toEqual(["lương", "pho", "phở bò", "Phở bò"]);
    expect((await repo.list({ categoryId: move })).map((r) => r.note)).toEqual(["pho"]);
    expect((await repo.list({ ...month, type: "income" })).map((r) => r.note)).toEqual(["lương"]);
    expect((await repo.list({ moneySource: "Techcombank" })).map((r) => r.note)).toEqual(["phở bò"]);
    expect((await repo.list({ ...month, categoryId: food, moneySource: "Tiền mặt" })).map((r) => r.note)).toEqual([
      "Phở bò",
    ]);
    expect((await repo.list({ ...month, search: "phở" })).map((r) => r.note)).toEqual(["phở bò", "Phở bò"]);
    expect((await repo.list({ search: "PHỞ" })).map((r) => r.note)).toEqual(["phở bò", "Phở bò"]);
  });

  it("AC5: photo, money source and occurred_at survive reopen", async () => {
    const file = tmpFile();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(19, 30, 0, 0);
    const a = setup(file);
    const row = await a.repo.create({
      ...base,
      photo_uri: "file:///bill.jpg",
      money_source: "Tiền mặt",
      occurred_at: yesterday.toString(),
    });
    expect(row.occurred_at).toBe(yesterday.toISOString());
    a.sqlite.close();
    const b = setup(file);
    const back = await b.repo.getById(row.id);
    expect(back?.photo_uri).toBe("file:///bill.jpg");
    expect(back?.money_source).toBe("Tiền mặt");
    expect(back?.occurred_at).toBe(yesterday.toISOString());
    b.sqlite.close();
  });

  it("AC6: works offline on a local db only", async () => {
    const { repo } = setup();
    await repo.create(base);
    await repo.list();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates type, source, category and date", async () => {
    const { repo } = setup();
    expect(await code(repo.create({ ...base, type: "x" as never }))).toBe("invalid_type");
    expect(await code(repo.create({ ...base, source: "x" as never }))).toBe("invalid_source");
    expect(await code(repo.create({ ...base, category_id: "" }))).toBe("category_required");
    expect(await code(repo.create({ ...base, category_id: "missing" }))).toBe("category_required");
    expect(await code(repo.create({ ...base, occurred_at: "garbage" }))).toBe("invalid_occurred_at");
  });

  it("update changes fields, bumps updated_at; qr_data round-trips", async () => {
    const { repo } = setup();
    const row = await repo.create({ ...base, source: "qr", qr_data: "000201..." });
    expect(row.qr_data).toBe("000201...");
    await tick();
    const up = await repo.update(row.id, { amount: 70000, note: "  cà phê ", category_id: move });
    expect(up.amount).toBe(70000);
    expect(up.note).toBe("cà phê");
    expect(up.category_id).toBe(move);
    expect(up.updated_at > row.updated_at).toBe(true);
    await repo.softDelete(row.id);
    expect(await code(repo.update(row.id, { amount: 1 }))).toBe("not_found");
  });
});
