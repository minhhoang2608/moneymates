import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";

import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { createCategoryRepository } from "../repositories";
import { category } from "../schema";
import { seedDefaultCategories, type AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const EXPENSE = ["Ăn uống", "Di chuyển", "Lưu trú", "Mua sắm", "Dịch vụ", "Hóa đơn", "Giải trí", "Sức khỏe", "Khác"];
const ANUONG = DEFAULT_CATEGORIES[0].id;

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

const setup = () => {
  const { db, sqlite } = openTestDb();
  return { db, sqlite, repo: createCategoryRepository(db as unknown as AnyDb) };
};

describe("category repository", () => {
  it("AC1: fresh DB lists the default expense and income categories in order", async () => {
    const { repo } = setup();
    const exp = await repo.listByKind("expense");
    expect(exp.map((c) => c.name)).toEqual(EXPENSE);
    expect((await repo.listByKind("income")).map((c) => c.name)).toEqual(["Lương", "Được trả lại", "Khác"]);
    for (const c of exp) {
      expect(c.is_default).toBe(true);
      expect(c.deleted_at).toBeNull();
      expect(c.owner_id).toBeNull();
      expect(c.created_at).toMatch(/Z$/);
    }
  });

  it("AC2: seeding twice and re-migrating never duplicates", async () => {
    const { db, sqlite } = setup();
    await seedDefaultCategories(db as unknown as AnyDb);
    await seedDefaultCategories(db as unknown as AnyDb);
    const rows = db.select().from(category).all();
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.id).sort()).toEqual(DEFAULT_CATEGORIES.map((d) => d.id).sort());
    expect((sqlite.prepare("select count(*) c from category").get() as { c: number }).c).toBe(12);
  });

  it("migration seed matches defaults.ts", () => {
    const { db } = setup();
    const rows = db.select().from(category).all();
    for (const d of DEFAULT_CATEGORIES) {
      expect(rows.find((r) => r.id === d.id)).toMatchObject({ ...d, is_default: true });
    }
  });

  it("AC3: default icon/colour change persists; rename and delete are rejected", async () => {
    const { db, repo } = setup();
    const before = db.select().from(category).where(eq(category.id, ANUONG)).get()!;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.update(ANUONG, { icon: "🍜", color: "#123456" });
    expect(updated).toMatchObject({ icon: "🍜", color: "#123456", name: "Ăn uống" });
    expect(updated.updated_at > before.updated_at).toBe(true);
    await expect(repo.update(ANUONG, { name: "X" })).rejects.toMatchObject({ code: "default_rename_forbidden" });
    await expect(repo.delete(ANUONG)).rejects.toMatchObject({ code: "default_delete_forbidden" });
    expect(db.select().from(category).where(eq(category.id, ANUONG)).get()!.deleted_at).toBeNull();
  });

  it("AC4: custom category persists across reopening; blank names rejected", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-cat-")), "t.db");
    const first = openTestDb(file);
    const repo1 = createCategoryRepository(first.db as unknown as AnyDb);
    await repo1.create({ name: "  Cà phê ", kind: "expense", icon: "CF", color: "#6B4423" });
    await expect(repo1.create({ name: "   ", kind: "expense", icon: "x", color: "y" })).rejects.toMatchObject({
      code: "name_required",
    });
    await expect(repo1.create({ name: "", kind: "expense", icon: "x", color: "y" })).rejects.toMatchObject({
      code: "name_required",
    });
    first.sqlite.close();

    const second = openTestDb(file);
    const names = (await createCategoryRepository(second.db as unknown as AnyDb).listByKind("expense")).map(
      (c) => c.name,
    );
    expect(names).toEqual([...EXPENSE, "Cà phê"]);
    second.sqlite.close();
  });

  it("AC5: renaming a custom category keeps its id and created_at", async () => {
    const { repo } = setup();
    const c = await repo.create({ name: "Cà phê", kind: "expense", icon: "CF", color: "#6B4423" });
    const r = await repo.update(c.id, { name: "Cafe" });
    expect(r).toMatchObject({ id: c.id, name: "Cafe", created_at: c.created_at });
  });

  it("soft-deletes custom categories and reports unknown ids", async () => {
    const { db, repo } = setup();
    const c = await repo.create({ name: "Thú cưng", kind: "expense", icon: "TC", color: "#3F6212" });
    await repo.delete(c.id);
    expect((await repo.listByKind("expense")).map((x) => x.name)).not.toContain("Thú cưng");
    expect(db.select().from(category).where(eq(category.id, c.id)).get()!.deleted_at).not.toBeNull();
    await expect(repo.delete(c.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.update("nope", { icon: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.update(ANUONG, { name: " " })).rejects.toMatchObject({ code: "name_required" });
  });
});
