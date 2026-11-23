import { db } from "@/db/client";
import { newId } from "@/db/ids";
import { createAppSettingRepository, type AppSettingRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";

const KEY = "device_id";

let store: Pick<AppSettingRepository, "get" | "set"> | null = null;
let cached: Promise<string> | null = null;

/** Test seam: use another settings repository. */
export function configureDeviceIdStore(repo: Pick<AppSettingRepository, "get" | "set"> | null): void {
  store = repo;
  cached = null;
}

export function resetDeviceIdCache(): void {
  cached = null;
}

function getStore() {
  if (!store) store = createAppSettingRepository(db as unknown as AnyDb);
  return store;
}

async function load(): Promise<string> {
  const repo = getStore();
  const existing = await repo.get<string>(KEY);
  if (typeof existing === "string" && existing) return existing;
  const id = newId();
  await repo.set(KEY, id);
  return id;
}

/** Stable per-install device id: generated once, persisted in app_setting. */
export function getDeviceId(): Promise<string> {
  if (!cached) {
    cached = load().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}
