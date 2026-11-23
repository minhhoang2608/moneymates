import { getTableConfig } from "drizzle-orm/sqlite-core";

import { newBaseRow } from "../columns";
import { appSetting } from "../schema";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("sync-ready base columns", () => {
  it("AC1: newBaseRow has a unique UUID v4 id and UTC timestamps", () => {
    const a = newBaseRow();
    const b = newBaseRow();
    expect(a.id).toMatch(UUID_V4);
    expect(a.id).not.toBe(b.id);
    expect(a.created_at.endsWith("Z")).toBe(true);
    expect(Number.isNaN(Date.parse(a.created_at))).toBe(false);
    expect(a.updated_at).toBe(a.created_at);
    expect(a.deleted_at).toBeNull();
    expect(a.owner_id).toBeNull();
  });

  it("AC1: table definition has the required columns with correct nullability", () => {
    const cols = Object.fromEntries(getTableConfig(appSetting).columns.map((c) => [c.name, c]));
    expect(cols.id.primary).toBe(true);
    expect(cols.created_at.notNull).toBe(true);
    expect(cols.updated_at.notNull).toBe(true);
    expect(cols.deleted_at.notNull).toBe(false);
    expect(cols.owner_id.notNull).toBe(false);
  });
});
