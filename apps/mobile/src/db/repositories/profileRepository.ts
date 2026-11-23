import { asc, eq, isNull } from "drizzle-orm";

import { nowUtc } from "../columns";
import { newId } from "../ids";
import { profile } from "../schema";
import type { AnyDb } from "../seed";

export type ProfileRow = typeof profile.$inferSelect;

export function createProfileRepository(db: AnyDb) {
  async function first(): Promise<ProfileRow | undefined> {
    const rows = await db.select().from(profile).where(isNull(profile.deleted_at)).orderBy(asc(profile.created_at));
    return rows[0];
  }

  async function ensure(): Promise<ProfileRow> {
    const existing = await first();
    if (existing) return existing;
    const now = nowUtc();
    await db.insert(profile).values({ id: newId(), created_at: now, updated_at: now, display_name: "" });
    return (await first()) as ProfileRow;
  }

  async function write(set: Partial<ProfileRow>): Promise<ProfileRow> {
    const current = await ensure();
    await db
      .update(profile)
      .set({ ...set, updated_at: nowUtc() })
      .where(eq(profile.id, current.id));
    return ensure();
  }

  return {
    /** The single profile row; created on first access. */
    getProfile: ensure,
    setDisplayName: (name: string) => write({ display_name: name.trim() }),
    setAvatar: (uri: string | null) => write({ avatar_uri: uri }),
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
