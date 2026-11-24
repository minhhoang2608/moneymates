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

/** Group trips. Dates are `YYYY-MM-DD`. `receiving_account_id` is where members pay "me" back. */
export const groups = sqliteTable(
  "groups",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default(""),
    start_date: text("start_date"),
    end_date: text("end_date"),
    receiving_account_id: text("receiving_account_id").references(() => bankAccount.id),
  },
  (t) => [
    index("groups_deleted_at_created_at_idx").on(t.deleted_at, t.created_at),
    check(
      "groups_dates_check",
      sql`${t.start_date} is null or ${t.end_date} is null or ${t.end_date} >= ${t.start_date}`,
    ),
  ],
);

/** Group members. The `is_me` row stores an empty name; its display name comes from the profile. */
export const groupMembers = sqliteTable(
  "group_members",
  {
    ...baseColumns(),
    group_id: text("group_id")
      .notNull()
      .references(() => groups.id),
    name: text("name").notNull().default(""),
    is_me: integer("is_me", { mode: "boolean" }).notNull().default(false),
    user_id: text("user_id"),
  },
  (t) => [
    index("group_members_group_id_deleted_at_idx").on(t.group_id, t.deleted_at),
    uniqueIndex("group_members_one_me_idx")
      .on(t.group_id)
      .where(sql`${t.is_me} = 1 and ${t.deleted_at} is null`),
  ],
);

/** Personal income/expense entries. Money is integer VND. `occurred_at` is ISO UTC. */
export const transactions = sqliteTable(
  "transactions",
  {
    ...baseColumns(),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("VND"),
    category_id: text("category_id")
      .notNull()
      .references(() => category.id),
    note: text("note").notNull().default(""),
    occurred_at: text("occurred_at").notNull(),
    money_source: text("money_source").notNull().default("Tiền mặt"),
    photo_uri: text("photo_uri"),
    source: text("source", { enum: ["manual", "qr", "voice", "bill"] })
      .notNull()
      .default("manual"),
    qr_data: text("qr_data"),
    group_id: text("group_id").references(() => groups.id),
    paid_by_member_id: text("paid_by_member_id").references(() => groupMembers.id),
    split_mode: text("split_mode", { enum: ["equal", "amount", "percent"] }),
  },
  (t) => [
    index("transactions_deleted_at_occurred_at_idx").on(t.deleted_at, t.occurred_at),
    index("transactions_category_id_idx").on(t.category_id),
    index("transactions_group_id_deleted_at_idx").on(t.group_id, t.deleted_at),
    check("transactions_amount_check", sql`${t.amount} > 0`),
    check("transactions_type_check", sql`${t.type} in ('expense', 'income')`),
    check("transactions_source_check", sql`${t.source} in ('manual', 'qr', 'voice', 'bill')`),
    check(
      "transactions_split_mode_check",
      sql`${t.split_mode} is null or ${t.split_mode} in ('equal', 'amount', 'percent')`,
    ),
  ],
);

/**
 * One member's share of a group expense. `amount` is integer VND. `value` is the raw input
 * (basis points for percent, đồng for amount, null for equal) so percent splits can be recomputed.
 */
export const expenseShares = sqliteTable(
  "expense_shares",
  {
    ...baseColumns(),
    transaction_id: text("transaction_id")
      .notNull()
      .references(() => transactions.id),
    member_id: text("member_id")
      .notNull()
      .references(() => groupMembers.id),
    amount: integer("amount").notNull(),
    value: integer("value"),
  },
  (t) => [
    index("expense_shares_transaction_id_deleted_at_idx").on(t.transaction_id, t.deleted_at),
    index("expense_shares_member_id_deleted_at_idx").on(t.member_id, t.deleted_at),
    check("expense_shares_amount_check", sql`${t.amount} >= 0`),
  ],
);

/**
 * Settlement payments of a group ("Tôi thu hộ"): `member_id` is the non-Tôi member.
 * `pay_to_me`: the member paid me. `pay_from_me`: I paid the member. `amount` is integer VND.
 */
export const settlementPayments = sqliteTable(
  "settlement_payments",
  {
    ...baseColumns(),
    group_id: text("group_id")
      .notNull()
      .references(() => groups.id),
    member_id: text("member_id")
      .notNull()
      .references(() => groupMembers.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("VND"),
    direction: text("direction", { enum: ["pay_to_me", "pay_from_me"] }).notNull(),
    paid_at: text("paid_at").notNull(),
  },
  (t) => [
    index("settlement_payments_group_id_deleted_at_idx").on(t.group_id, t.deleted_at),
    check("settlement_payments_amount_check", sql`${t.amount} > 0`),
    check("settlement_payments_direction_check", sql`${t.direction} in ('pay_to_me', 'pay_from_me')`),
  ],
);

/** User-chosen order of payment apps (`app_key` ids come from `src/lib/payConfirm/apps.ts`). */
export const paymentAppPrefs = sqliteTable(
  "payment_app_prefs",
  {
    ...baseColumns(),
    app_key: text("app_key").notNull(),
    sort_order: integer("sort_order").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("payment_app_prefs_app_key_idx")
      .on(t.app_key)
      .where(sql`${t.deleted_at} is null`),
  ],
);

/** Where money comes from ("Ghi vào"). Transactions reference the name in `transactions.money_source`. */
export const moneySources = sqliteTable(
  "money_sources",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["cash", "bank", "wallet", "card"] }).notNull(),
    is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("money_sources_deleted_at_created_at_idx").on(t.deleted_at, t.created_at),
    check("money_sources_kind_check", sql`${t.kind} in ('cash', 'bank', 'wallet', 'card')`),
  ],
);

export const HAND_OFF_METHODS = ["autofill", "share", "gallery", "paste"] as const;
export const PAID_SIGNALS = ["time", "notification", "receipt"] as const;

/** One hand-off to a bank/wallet app for a saved transaction. `paid_signal` stays null until a signal arrives. */
export const handOffs = sqliteTable(
  "hand_offs",
  {
    ...baseColumns(),
    transaction_id: text("transaction_id")
      .notNull()
      .references(() => transactions.id),
    app_id: text("app_id").notNull(),
    method: text("method", { enum: HAND_OFF_METHODS }).notNull(),
    qr_asset_id: text("qr_asset_id"),
    started_at: text("started_at").notNull(),
    returned_at: text("returned_at"),
    paid_signal: text("paid_signal", { enum: PAID_SIGNALS }),
    qr_deleted_at: text("qr_deleted_at"),
  },
  (t) => [
    index("hand_offs_transaction_id_idx").on(t.transaction_id),
    check("hand_offs_method_check", sql`${t.method} in ('autofill', 'share', 'gallery', 'paste')`),
    check(
      "hand_offs_paid_signal_check",
      sql`${t.paid_signal} is null or ${t.paid_signal} in ('time', 'notification', 'receipt')`,
    ),
  ],
);

export type HandOffMethod = (typeof HAND_OFF_METHODS)[number];
export type PaidSignal = (typeof PAID_SIGNALS)[number];
export type HandOffRow = typeof handOffs.$inferSelect;
