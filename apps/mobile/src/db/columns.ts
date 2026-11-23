import { text } from "drizzle-orm/sqlite-core";

import { newId } from "./ids";

export function nowUtc(): string {
  return new Date().toISOString();
}

/** Sync-ready columns every table carries. */
export function baseColumns() {
  return {
    id: text("id").primaryKey().$defaultFn(newId),
    created_at: text("created_at").notNull().$defaultFn(nowUtc),
    updated_at: text("updated_at").notNull().$defaultFn(nowUtc).$onUpdateFn(nowUtc),
    deleted_at: text("deleted_at"),
    owner_id: text("owner_id"),
  };
}

export type BaseRow = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string | null;
};

export function newBaseRow(now: string = nowUtc()): BaseRow {
  return { id: newId(), created_at: now, updated_at: now, deleted_at: null, owner_id: null };
}
