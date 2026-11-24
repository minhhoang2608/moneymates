import type { AppSettingRepository } from "@/db/repositories/appSettingRepository";

import { normalizeAppId } from "./apps";
import type { PayApp } from "./apps";

export const COACH_KEY = "pay.coach_dismissed";

export type CoachMode = "sheet" | "toast" | "none";

/** Autofill apps need no hint. Other apps get the sheet once, then a short toast after "Không hiện lại". */
export function needsCoach(app: Pick<PayApp, "id" | "supportsAutofill">, dismissed: string[]): CoachMode {
  if (app.supportsAutofill) return "none";
  return dismissed.map(normalizeAppId).includes(normalizeAppId(app.id)) ? "toast" : "sheet";
}

export function createCoachStore(appSettings: Pick<AppSettingRepository, "get" | "set">) {
  const list = async (): Promise<string[]> => {
    const ids = await appSettings.get<string[]>(COACH_KEY);
    return Array.isArray(ids) ? ids : [];
  };
  return {
    list,
    async dismiss(appId: string): Promise<string[]> {
      const id = normalizeAppId(appId);
      const cur = await list();
      if (cur.map(normalizeAppId).includes(id)) return cur;
      const next = [...cur, id];
      await appSettings.set(COACH_KEY, next);
      return next;
    },
  };
}
