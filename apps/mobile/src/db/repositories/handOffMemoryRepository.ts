import { PREF_KEYS } from "../../lib/preferences/defaults";
import { recordShareResult, type ShareMemory } from "../../lib/payConfirm/shareMemory";
import type { AnyDb } from "../seed";
import { createAppSettingRepository } from "./appSettingRepository";

export function createHandOffMemoryRepository(db: AnyDb) {
  const settings = createAppSettingRepository(db);
  async function getShareMemory(): Promise<ShareMemory> {
    const v = await settings.get<ShareMemory>(PREF_KEYS.directShareMemory);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  }
  return {
    getShareMemory,
    async setShareResult(appId: string, worked: boolean): Promise<void> {
      await settings.set(PREF_KEYS.directShareMemory, recordShareResult(await getShareMemory(), appId, worked));
    },
    async getDefaultSuggestionDismissed(): Promise<boolean> {
      return (await settings.get<boolean>(PREF_KEYS.defaultBankSuggestionDismissed)) === true;
    },
    async dismissDefaultSuggestion(): Promise<void> {
      await settings.set(PREF_KEYS.defaultBankSuggestionDismissed, true);
    },
  };
}

export type HandOffMemoryRepository = ReturnType<typeof createHandOffMemoryRepository>;
