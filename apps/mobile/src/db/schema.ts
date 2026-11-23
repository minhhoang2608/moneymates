import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { baseColumns } from "./columns";

/** Device-only key/value settings. `value` is JSON-encoded. */
export const appSetting = sqliteTable("app_setting", {
  ...baseColumns(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});
