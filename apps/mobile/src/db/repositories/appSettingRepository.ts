import { and, eq, isNull } from "drizzle-orm";

import { nowUtc } from "../columns";
import { newId } from "../ids";
import { appSetting } from "../schema";
import type { AnyDb } from "../seed";

export function createAppSettingRepository(db: AnyDb) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const rows = await db
        .select()
        .from(appSetting)
        .where(and(eq(appSetting.key, key), isNull(appSetting.deleted_at)));
      if (rows.length === 0) return null;
      try {
        return JSON.parse(rows[0].value) as T;
      } catch {
        return null;
      }
    },

    /** Upsert on the unique key; revives a soft-deleted row. */
    async set(key: string, value: unknown): Promise<void> {
      const now = nowUtc();
      const json = JSON.stringify(value);
      await db
        .insert(appSetting)
        .values({ id: newId(), created_at: now, updated_at: now, key, value: json })
        .onConflictDoUpdate({ target: appSetting.key, set: { value: json, updated_at: now, deleted_at: null } });
    },
  };
}

export type AppSettingRepository = ReturnType<typeof createAppSettingRepository>;
