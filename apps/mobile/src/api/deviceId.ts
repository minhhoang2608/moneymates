import { db } from "@/db/client";
import { newId } from "@/db/ids";
import { createAppSettingRepository, type AppSettingRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";

const KEY = "device_id";

let repo: AppSettingRepository | null = null;
let cached: Promise<string> | null = null;

/** Test seam: use another app_setting repository. */
export function configureDeviceIdStore(r: AppSettingRepository): void {
  repo = r;
  cached = null;
}

export function resetDeviceIdCache(): void {
  cached = null;
}

/** Stable per-install id: read from app_setting, or generated and persisted once. */
export function getDeviceId(): Promise<string> {
  if (!cached) {
    const store = (repo ??= createAppSettingRepository(db as unknown as AnyDb));
    const p = (async () => {
      const existing = await store.get<string>(KEY);
      if (existing) return existing;
      const id = newId();
      await store.set(KEY, id);
      return id;
    })();
    cached = p;
    p.catch(() => {
      if (cached === p) cached = null;
    });
  }
  return cached;
}
