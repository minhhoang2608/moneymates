import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { newBaseRow } from "../columns";
import { appSetting } from "../schema";

const folder = path.join(__dirname, "..", "migrations");

describe("local migrations", () => {
  it("AC2: apply offline, create base columns, round-trip, and are idempotent", () => {
    const fetchMock = jest.fn(() => {
      throw new Error("network disabled");
    });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const sqlite = new Database(":memory:");
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: folder });
      migrate(db, { migrationsFolder: folder });

      const cols = (sqlite.pragma("table_info(app_setting)") as { name: string }[]).map((c) => c.name);
      for (const c of ["id", "created_at", "updated_at", "deleted_at", "owner_id"]) {
        expect(cols).toContain(c);
      }

      for (const table of ["profile", "bank_account", "transactions", "groups", "group_members"]) {
        const names = (sqlite.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name);
        for (const c of ["id", "created_at", "updated_at", "deleted_at", "owner_id"]) {
          expect(names).toContain(c);
        }
      }

      const txCols = (sqlite.pragma("table_info(transactions)") as { name: string }[]).map((c) => c.name);
      expect(txCols).toContain("group_id");
      expect(txCols).toContain("split_mode");
      const shareCols = (sqlite.pragma("table_info(expense_shares)") as { name: string }[]).map((c) => c.name);
      for (const c of [
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "owner_id",
        "transaction_id",
        "member_id",
        "amount",
        "value",
      ]) {
        expect(shareCols).toContain(c);
      }
      const payCols = (sqlite.pragma("table_info(settlement_payments)") as { name: string }[]).map((c) => c.name);
      for (const c of [
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "owner_id",
        "group_id",
        "member_id",
        "amount",
        "currency",
        "direction",
        "paid_at",
      ]) {
        expect(payCols).toContain(c);
      }
      const ddl = (
        sqlite.prepare("select sql from sqlite_master where name = 'settlement_payments'").get() as { sql: string }
      ).sql;
      expect(ddl).toContain("settlement_payments_amount_check");
      expect(ddl).toContain("settlement_payments_direction_check");

      db.insert(appSetting)
        .values({ ...newBaseRow(), key: "k", value: JSON.stringify({ a: 1 }) })
        .run();
      const rows = db.select().from(appSetting).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].key).toBe("k");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});
