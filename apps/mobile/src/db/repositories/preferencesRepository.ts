import {
  DEFAULT_CURRENCY,
  NON_AUTOFILL_MODES,
  PREF_KEYS,
  PreferencesError,
  normalizeNonAutofillMode,
  type NonAutofillMode,
} from "../../lib/preferences/defaults";
import { createAppSettingRepository } from "./appSettingRepository";
import type { AnyDb } from "../seed";

export function createPreferencesRepository(db: AnyDb) {
  const settings = createAppSettingRepository(db);
  return {
    async getAlertOverLastMonth(): Promise<boolean> {
      const v = await settings.get<boolean>(PREF_KEYS.alertOverLastMonth);
      return typeof v === "boolean" ? v : true;
    },
    async setAlertOverLastMonth(on: boolean): Promise<void> {
      await settings.set(PREF_KEYS.alertOverLastMonth, on);
    },
    async getAppLockEnabled(): Promise<boolean> {
      const v = await settings.get<boolean>(PREF_KEYS.appLockEnabled);
      return v === true;
    },
    async setAppLockEnabled(on: boolean): Promise<void> {
      await settings.set(PREF_KEYS.appLockEnabled, on);
    },
    async getDefaultCurrency(): Promise<string> {
      const v = await settings.get<string>(PREF_KEYS.defaultCurrency);
      return typeof v === "string" && v ? v : DEFAULT_CURRENCY;
    },
    async setDefaultCurrency(code: string): Promise<void> {
      const clean = code.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(clean)) throw new PreferencesError("invalid_currency");
      await settings.set(PREF_KEYS.defaultCurrency, clean);
    },
    async getNonAutofillMode(): Promise<NonAutofillMode> {
      return normalizeNonAutofillMode(await settings.get<unknown>(PREF_KEYS.nonAutofillMode));
    },
    async setNonAutofillMode(mode: NonAutofillMode): Promise<void> {
      if (!NON_AUTOFILL_MODES.includes(mode)) throw new PreferencesError("invalid_mode");
      await settings.set(PREF_KEYS.nonAutofillMode, mode);
    },
  };
}

export type PreferencesRepository = ReturnType<typeof createPreferencesRepository>;
