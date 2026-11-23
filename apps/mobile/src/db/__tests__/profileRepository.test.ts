import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProfileRepository } from "../repositories";
import { profile } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const original = global.fetch;
const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled();
});

describe("profile repository", () => {
  it("creates exactly one row lazily", async () => {
    const { db } = openTestDb();
    const repo = createProfileRepository(db as unknown as AnyDb);
    const a = await repo.getProfile();
    const b = await repo.getProfile();
    expect(a.id).toBe(b.id);
    expect(a.display_name).toBe("");
    expect(a.avatar_uri).toBeNull();
    expect(db.select().from(profile).all()).toHaveLength(1);
  });

  it("AC1: name and avatar persist after reopening the DB", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-profile-")), "t.db");
    const first = openTestDb(file);
    const repo = createProfileRepository(first.db as unknown as AnyDb);
    const before = await repo.getProfile();
    await repo.setDisplayName("  Hoàng ");
    await repo.setAvatar("file:///avatar.jpg");
    first.sqlite.close();

    const second = openTestDb(file);
    const p = await createProfileRepository(second.db as unknown as AnyDb).getProfile();
    expect(p.id).toBe(before.id);
    expect(p.display_name).toBe("Hoàng");
    expect(p.avatar_uri).toBe("file:///avatar.jpg");
    expect(second.db.select().from(profile).all()).toHaveLength(1);
    second.sqlite.close();
  });

  it("setAvatar(null) clears it and writes bump updated_at", async () => {
    const { db } = openTestDb();
    const repo = createProfileRepository(db as unknown as AnyDb);
    await repo.setAvatar("file:///a.jpg");
    const a = await repo.getProfile();
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.setAvatar(null);
    expect(b.avatar_uri).toBeNull();
    expect(b.updated_at > a.updated_at).toBe(true);
  });
});
