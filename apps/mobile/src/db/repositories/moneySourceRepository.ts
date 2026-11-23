import { and, asc, eq, isNull } from "drizzle-orm";

import { MONEY_SOURCE_KINDS, PreferencesError, type MoneySourceKind } from "../../lib/preferences/defaults";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { moneySources } from "../schema";
import type { AnyDb } from "../seed";

export type MoneySourceRow = typeof moneySources.$inferSelect;

const live = isNull(moneySources.deleted_at);

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new PreferencesError("name_required");
  return trimmed;
}

export function createMoneySourceRepository(db: AnyDb) {
  async function find(id: string): Promise<MoneySourceRow> {
    const rows = await db
      .select()
      .from(moneySources)
      .where(and(eq(moneySources.id, id), live));
    if (rows.length === 0) throw new PreferencesError("not_found");
    return rows[0];
  }

  return {
    /** Live sources: defaults first (seeded order), then custom ones by creation time. */
    async listSources(): Promise<MoneySourceRow[]> {
      const rows = await db.select().from(moneySources).where(live).orderBy(asc(moneySources.created_at));
      return [...rows.filter((r) => r.is_default), ...rows.filter((r) => !r.is_default)];
    },

    async addSource(name: string, kind: MoneySourceKind): Promise<MoneySourceRow> {
      const clean = cleanName(name);
      if (!MONEY_SOURCE_KINDS.includes(kind)) throw new PreferencesError("invalid_kind");
      const now = nowUtc();
      const id = newId();
      await db.insert(moneySources).values({ id, created_at: now, updated_at: now, name: clean, kind });
      return find(id);
    },

    async renameSource(id: string, name: string): Promise<MoneySourceRow> {
      const clean = cleanName(name);
      await find(id);
      await db.update(moneySources).set({ name: clean, updated_at: nowUtc() }).where(eq(moneySources.id, id));
      return find(id);
    },

    /** Soft delete. Transactions keep their `money_source` text untouched. */
    async deleteSource(id: string): Promise<void> {
      await find(id);
      const now = nowUtc();
      await db.update(moneySources).set({ deleted_at: now, updated_at: now }).where(eq(moneySources.id, id));
    },
  };
}

export type MoneySourceRepository = ReturnType<typeof createMoneySourceRepository>;
