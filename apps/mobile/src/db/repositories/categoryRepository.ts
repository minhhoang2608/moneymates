import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq, isNull } from "drizzle-orm";

import { DEFAULT_CATEGORIES } from "../../lib/category/defaults";
import { CategoryError, type CategoryKind } from "../../lib/category/types";
import { newId } from "../ids";
import { nowUtc } from "../columns";
import { category, transactions } from "../schema";
import type { AnyDb } from "../seed";

export type CategoryRow = typeof category.$inferSelect;

export type NewCategory = { name: string; kind: CategoryKind; icon: string; color: string };
export type CategoryPatch = { name?: string; icon?: string; color?: string };

type SyncTxDb = {
  transaction: (fn: (tx: BetterSQLite3Database) => void) => void;
};

const defaultOrder = new Map(DEFAULT_CATEGORIES.map((d, i) => [d.id, i]));

export function createCategoryRepository(db: AnyDb) {
  async function find(id: string): Promise<CategoryRow> {
    const rows = await db
      .select()
      .from(category)
      .where(and(eq(category.id, id), isNull(category.deleted_at)));
    if (rows.length === 0) throw new CategoryError("not_found");
    return rows[0];
  }

  return {
    /** Defaults first in canonical order, then custom categories by creation time. */
    async listByKind(kind: CategoryKind): Promise<CategoryRow[]> {
      const rows = await db
        .select()
        .from(category)
        .where(and(eq(category.type, kind), isNull(category.deleted_at)));
      const rank = (r: CategoryRow) => (r.is_default ? (defaultOrder.get(r.id) ?? 0) : Number.MAX_SAFE_INTEGER);
      return rows.sort(
        (a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      );
    },

    async create(input: NewCategory): Promise<CategoryRow> {
      const name = input.name.trim();
      if (!name) throw new CategoryError("name_required");
      const now = nowUtc();
      const row = {
        id: newId(),
        created_at: now,
        updated_at: now,
        name,
        type: input.kind,
        icon: input.icon,
        color: input.color,
        is_default: false,
      };
      await db.insert(category).values(row);
      return find(row.id);
    },

    async update(id: string, patch: CategoryPatch): Promise<CategoryRow> {
      const current = await find(id);
      const set: Partial<CategoryRow> = { updated_at: nowUtc() };
      if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (!name) throw new CategoryError("name_required");
        if (current.is_default && name !== current.name) throw new CategoryError("default_rename_forbidden");
        set.name = name;
      }
      if (patch.icon !== undefined) set.icon = patch.icon;
      if (patch.color !== undefined) set.color = patch.color;
      await db.update(category).set(set).where(eq(category.id, id));
      return find(id);
    },

    /**
     * Soft delete a custom category. Its live transactions move to the default "Khác" of the same
     * type in the same database transaction. Defaults can't be deleted.
     */
    async deleteCategory(id: string): Promise<void> {
      const current = await find(id);
      if (current.is_default) throw new CategoryError("default_delete_forbidden");
      const khac = DEFAULT_CATEGORIES.find((d) => d.name === "Khác" && d.type === current.type);
      if (!khac) throw new CategoryError("not_found");
      const now = nowUtc();
      // expo-sqlite and better-sqlite3 are synchronous drivers: the callback must not be async.
      (db as unknown as SyncTxDb).transaction((tx) => {
        tx.update(transactions)
          .set({ category_id: khac.id, updated_at: now })
          .where(and(eq(transactions.category_id, id), isNull(transactions.deleted_at)))
          .run();
        tx.update(category).set({ deleted_at: now, updated_at: now }).where(eq(category.id, id)).run();
      });
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
