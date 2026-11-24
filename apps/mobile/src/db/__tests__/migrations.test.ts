import fs from "node:fs";
import os from "node:os";
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

  it("preferences migration: tables, kind check and idempotent seed", () => {
    const sqlite = new Database(":memory:");
    migrate(drizzle(sqlite), { migrationsFolder: folder });
    for (const [table, extra] of [
      ["payment_app_prefs", ["app_key", "sort_order"]],
      ["money_sources", ["name", "kind", "is_default"]],
    ] as const) {
      const names = (sqlite.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name);
      for (const c of ["id", "created_at", "updated_at", "deleted_at", "owner_id", ...extra]) {
        expect(names).toContain(c);
      }
    }
    const now = "2026-01-01T00:00:00.000Z";
    expect(() =>
      sqlite
        .prepare("insert into money_sources (id, created_at, updated_at, name, kind) values ('x', ?, ?, 'X', 'crypto')")
        .run(now, now),
    ).toThrow();
    const count = () =>
      (sqlite.prepare("select count(*) as n from money_sources where is_default = 1").get() as { n: number }).n;
    expect(count()).toBe(4);
    const seed = sqlite.prepare("select id, name, kind from money_sources where is_default = 1").all() as {
      id: string;
      name: string;
      kind: string;
    }[];
    const ins = sqlite.prepare(
      "insert or ignore into money_sources (id, created_at, updated_at, name, kind, is_default) values (?, ?, ?, ?, ?, 1)",
    );
    for (const r of seed) ins.run(r.id, now, now, r.name, r.kind);
    expect(count()).toBe(4);
  });

  it("AC4: payment_app_prefs enabled migration is additive and idempotent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
    fs.cpSync(folder, tmp, { recursive: true });
    const journalPath = path.join(tmp, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const full = { ...journal };
    fs.writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, 8) }));

    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: tmp });
    const before = (sqlite.pragma("table_info(payment_app_prefs)") as { name: string }[]).map((c) => c.name);
    expect(before).not.toContain("enabled");
    const ts = "2026-01-01T00:00:00.000Z";
    sqlite
      .prepare("insert into payment_app_prefs (id, created_at, updated_at, app_key, sort_order) values (?,?,?,?,?)")
      .run("a", ts, ts, "momo", 0);
    sqlite
      .prepare("insert into payment_app_prefs (id, created_at, updated_at, app_key, sort_order) values (?,?,?,?,?)")
      .run("b", ts, ts, "mb", 1);

    migrate(db, { migrationsFolder: folder });
    migrate(db, { migrationsFolder: folder });
    expect(full.entries.length).toBeGreaterThan(8);
    const after = (sqlite.pragma("table_info(payment_app_prefs)") as { name: string }[]).map((c) => c.name);
    expect(after).toContain("enabled");
    const rows = sqlite.prepare("select app_key, enabled from payment_app_prefs order by sort_order").all();
    expect(rows).toEqual([
      { app_key: "momo", enabled: 1 },
      { app_key: "mb", enabled: 1 },
    ]);
  });
});

describe("hand_offs migration", () => {
  it("has the base columns and every HandOff field, and the CHECKs reject bad values", () => {
    const sqlite = new Database(":memory:");
    migrate(drizzle(sqlite), { migrationsFolder: folder });
    const names = (sqlite.pragma("table_info(hand_offs)") as { name: string }[]).map((c) => c.name);
    for (const c of [
      "id",
      "created_at",
      "updated_at",
      "deleted_at",
      "owner_id",
      "transaction_id",
      "app_id",
      "method",
      "qr_asset_id",
      "started_at",
      "returned_at",
      "paid_signal",
      "qr_deleted_at",
    ]) {
      expect(names).toContain(c);
    }
    sqlite.pragma("foreign_keys = OFF");
    const insert = (method: string, signal: string | null) =>
      sqlite
        .prepare(
          "insert into hand_offs (id, created_at, updated_at, transaction_id, app_id, method, started_at, paid_signal) values (?, 'a', 'a', 't', 'mb', ?, 'a', ?)",
        )
        .run(`id-${Math.random()}`, method, signal);
    expect(() => insert("share", "time")).not.toThrow();
    expect(() => insert("bogus", null)).toThrow();
    expect(() => insert("share", "bogus")).toThrow();
  });
});
