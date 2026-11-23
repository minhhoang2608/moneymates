import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/** The single local profile row. Created lazily by the repository. */
export const profile = sqliteTable("profile", {
  ...baseColumns(),
  display_name: text("display_name").notNull().default(""),
  avatar_uri: text("avatar_uri"),
});

/** Bank accounts used to receive money (VietQR). At most one live default. */
export const bankAccount = sqliteTable(
  "bank_account",
  {
    ...baseColumns(),
    bank_bin: text("bank_bin").notNull(),
    bank_name: text("bank_name").notNull(),
    account_no: text("account_no").notNull(),
    account_name: text("account_name").notNull(),
    is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("bank_account_one_default_idx")
      .on(t.is_default)
      .where(sql`${t.is_default} = 1 and ${t.deleted_at} is null`),
    index("bank_account_deleted_at_created_at_idx").on(t.deleted_at, t.created_at),
  ],
);
