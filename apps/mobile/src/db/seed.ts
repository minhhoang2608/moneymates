import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { DEFAULT_CATEGORIES } from "../lib/category/defaults";
import { category } from "./schema";

export type AnyDb = BaseSQLiteDatabase<"sync" | "async", any, any>;

/** Idempotent: inserts any missing default category by its stable id. The migration seeds the same rows. */
export async function seedDefaultCategories(db: AnyDb): Promise<void> {
  const now = new Date().toISOString();
  for (const d of DEFAULT_CATEGORIES) {
    await db
      .insert(category)
      .values({ ...d, is_default: true, created_at: now, updated_at: now })
      .onConflictDoNothing({ target: category.id });
  }
}
