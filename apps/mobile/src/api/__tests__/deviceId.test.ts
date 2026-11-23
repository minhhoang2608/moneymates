import { openTestDb } from "@/db/testing/testDb";
import { tmpDbFile } from "@/db/testing/tmpFile";
import { createAppSettingRepository } from "@/db/repositories";
import { appSetting } from "@/db/schema";
import type { AnyDb } from "@/db/seed";

import { configureDeviceIdStore, getDeviceId, resetDeviceIdCache } from "../deviceId";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const repoFor = (db: unknown) => createAppSettingRepository(db as AnyDb);

afterEach(() => configureDeviceIdStore(null));

describe("device id", () => {
  it("AC3: generated once, same across calls and simulated restarts", async () => {
    const file = tmpDbFile();
    const first = openTestDb(file);
    configureDeviceIdStore(repoFor(first.db));
    const a = await getDeviceId();
    expect(a).toMatch(UUID);
    expect(await getDeviceId()).toBe(a);

    resetDeviceIdCache();
    configureDeviceIdStore(repoFor(openTestDb(file).db));
    expect(await getDeviceId()).toBe(a);
  });

  it("concurrent first calls create a single row", async () => {
    const { db } = openTestDb();
    configureDeviceIdStore(repoFor(db));
    const ids = await Promise.all([getDeviceId(), getDeviceId(), getDeviceId()]);
    expect(new Set(ids).size).toBe(1);
    expect(await db.select().from(appSetting)).toHaveLength(1);
  });
});
