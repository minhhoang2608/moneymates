import type { PayApp } from "../payConfirm/apps";
import snapshot from "./bankApps.snapshot.json";

/** Contract of GET /banks/apps. */
export type BankAppDto = {
  app_id: string;
  name: string;
  logo: string | null;
  bank_code: string | null;
  bin: string | null;
  autofill: { android: boolean; ios: boolean };
  ios_scheme: string | null;
  android_package: string | null;
};

export type BankAppsResponse = { updated_at: string; stale: boolean; apps: BankAppDto[] };

export interface BankAppsSource {
  load(): Promise<BankAppsResponse>;
}

export const SNAPSHOT = snapshot as BankAppsResponse;

/** The bundled registry snapshot: works offline. The live adapter comes in the integration ticket. */
export const snapshotSource: BankAppsSource = { load: async () => SNAPSHOT };

export function createMockSource(data: BankAppsResponse): BankAppsSource {
  return { load: async () => data };
}

export type Platform = "android" | "ios";

export function toPayApp(dto: BankAppDto, platform: Platform): PayApp {
  return {
    id: dto.app_id,
    name: dto.name,
    short: dto.bank_code ?? dto.app_id.toUpperCase(),
    scheme: dto.ios_scheme ?? undefined,
    androidPackage: dto.android_package ?? undefined,
    deeplinkCode: dto.app_id,
    supportsAutofill: dto.autofill[platform],
  };
}

export function registryPayApps(platform: Platform, data: BankAppsResponse = SNAPSHOT): PayApp[] {
  return data.apps.map((a) => toPayApp(a, platform));
}
