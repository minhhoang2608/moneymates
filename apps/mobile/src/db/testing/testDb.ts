import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const folder = path.join(__dirname, "..", "migrations");

/** Opens a SQLite file (default in-memory), runs the real migrations, returns the drizzle db. */
export function openTestDb(file = ":memory:") {
  const sqlite = new Database(file);
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: folder });
  return { sqlite, db };
}
