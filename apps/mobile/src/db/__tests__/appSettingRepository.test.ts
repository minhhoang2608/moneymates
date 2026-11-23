import { createAppSettingRepository } from "../repositories";
import { appSetting } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const tick = () => new Promise((r) => setTimeout(r, 3));

describe("appSettingRepository", () => {
  it("get on a missing key returns null", async () => {
    const { db } = openTestDb();
    expect(await createAppSettingRepository(db as unknown as AnyDb).get("x")).toBeNull();
  });

  it("set then get round-trips and a second set updates the same row", async () => {
    const { db } = openTestDb();
    const repo = createAppSettingRepository(db as unknown as AnyDb);
    await repo.set("pay.recent_apps", ["mb"]);
    const first = (await db.select().from(appSetting))[0];
    await tick();
    await repo.set("pay.recent_apps", ["momo", "mb"]);
    const rows = await db.select().from(appSetting);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id);
    expect(rows[0].updated_at > first.updated_at).toBe(true);
    expect(await repo.get<string[]>("pay.recent_apps")).toEqual(["momo", "mb"]);
  });
});
