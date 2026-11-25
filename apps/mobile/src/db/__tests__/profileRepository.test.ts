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

  it("AC1: fresh DB returns null for onboarding_completed_at", async () => {
    const { db } = openTestDb();
    const repo = createProfileRepository(db as unknown as AnyDb);
    expect(await repo.getOnboardingCompletedAt()).toBeNull();
  });

  it("AC1: markOnboardingCompleted sets a UTC ISO timestamp and bumps updated_at", async () => {
    const { db } = openTestDb();
    const repo = createProfileRepository(db as unknown as AnyDb);
    const marked = await repo.markOnboardingCompleted();
    const v = marked.onboarding_completed_at as string;
    expect(v).toMatch(/Z$/);
    expect(new Date(v).toISOString()).toBe(v);
    expect(await repo.getOnboardingCompletedAt()).toBe(v);
    expect(db.select().from(profile).all()).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 5));
    const again = await repo.markOnboardingCompleted();
    expect(again.updated_at > marked.updated_at).toBe(true);
  });

  it("AC2: resetOnboarding clears the timestamp and keeps display_name/avatar_uri", async () => {
    const { db } = openTestDb();
    const repo = createProfileRepository(db as unknown as AnyDb);
    await repo.setDisplayName("Hoàng");
    await repo.setAvatar("file:///a.jpg");
    await repo.markOnboardingCompleted();
    const r = await repo.resetOnboarding();
    expect(r.onboarding_completed_at).toBeNull();
    expect(r.display_name).toBe("Hoàng");
    expect(r.avatar_uri).toBe("file:///a.jpg");
  });
});
