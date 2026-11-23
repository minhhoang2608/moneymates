import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { baseColumns } from "./columns";

/** Device-only key/value settings. `value` is JSON-encoded. */
export const appSetting = sqliteTable("app_setting", {
  ...baseColumns(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

/** Expense/income categories. Defaults are seeded by migration and can't be renamed or deleted. */
export const category = sqliteTable(
  "category",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("category_type_deleted_at_idx").on(t.type, t.deleted_at),
    check("category_type_check", sql`${t.type} in ('expense', 'income')`),
  ],
);
