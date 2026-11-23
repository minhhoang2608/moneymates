import { createAppSettingRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { appSetting } from "@/db/schema";
import { tmpDbFile } from "@/db/testing/tmpFile";
import { openTestDb } from "@/db/testing/testDb";

import { apiPost } from "../client";
import { configureDeviceIdStore, getDeviceId, resetDeviceIdCache } from "../deviceId";

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
  resetDeviceIdCache();
});

function open(file: string) {
  const { db } = openTestDb(file);
  return { db, repo: createAppSettingRepository(db as unknown as AnyDb) };
}

describe("getDeviceId", () => {
  it("AC3: is a persisted UUID that survives a restart", async () => {
    const file = tmpDbFile();
    configureDeviceIdStore(open(file).repo);
    const a = await getDeviceId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await getDeviceId()).toBe(a);

    resetDeviceIdCache();
    configureDeviceIdStore(open(file).repo);
    expect(await getDeviceId()).toBe(a);
  });

  it("concurrent first calls create one row and share one id", async () => {
    const { db, repo } = open(":memory:");
    configureDeviceIdStore(repo);
    const ids = await Promise.all([getDeviceId(), getDeviceId(), getDeviceId()]);
    expect(new Set(ids).size).toBe(1);
    expect(await db.select().from(appSetting)).toHaveLength(1);
  });

  it("two requests send the same X-Device-Id", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.test";
    configureDeviceIdStore(open(":memory:").repo);
    const fn = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = fn as unknown as typeof fetch;
    await apiPost("/a", {});
    await apiPost("/b", {});
    const ids = fn.mock.calls.map(
      (c) => ((c as unknown[])[1] as { headers: Record<string, string> }).headers["X-Device-Id"],
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
  });
});
