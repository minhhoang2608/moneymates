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

const isStrOrNull = (v: unknown) => v === null || typeof v === "string";

function isBankAppDto(v: unknown): v is BankAppDto {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  const af = a.autofill as Record<string, unknown> | null | undefined;
  return (
    typeof a.app_id === "string" &&
    a.app_id.length > 0 &&
    typeof a.name === "string" &&
    isStrOrNull(a.logo) &&
    isStrOrNull(a.bank_code) &&
    isStrOrNull(a.bin) &&
    isStrOrNull(a.ios_scheme) &&
    isStrOrNull(a.android_package) &&
    !!af &&
    typeof af === "object" &&
    typeof af.android === "boolean" &&
    typeof af.ios === "boolean"
  );
}

/** Runtime contract guard for GET /banks/apps. Any invalid entry invalidates the whole response. */
export function parseBankAppsResponse(raw: unknown): BankAppsResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.updated_at !== "string" || typeof r.stale !== "boolean") return null;
  if (!Array.isArray(r.apps) || r.apps.length === 0 || !r.apps.every(isBankAppDto)) return null;
  return { updated_at: r.updated_at, stale: r.stale, apps: r.apps };
}

export function createMockSource(data: BankAppsResponse): BankAppsSource {
  return { load: async () => data };
}

export type Platform = "android" | "ios";

export function toPayApp(dto: BankAppDto, platform: Platform): PayApp {
  return {
    id: dto.app_id,
    bin: dto.bin ?? undefined,
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
