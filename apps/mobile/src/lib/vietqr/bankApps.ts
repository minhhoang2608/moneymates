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
    type: "bank",
    bin: dto.bin ?? undefined,
    name: dto.name,
    short: dto.bank_code ?? dto.app_id.toUpperCase(),
    scheme: dto.ios_scheme ?? undefined,
    androidPackage: dto.android_package ?? undefined,
    deeplinkCode: dto.app_id,
    supportsAutofill: dto.autofill[platform],
  };
}

/**
 * Fills the launch fields (iOS scheme, Android package) a live row lacks from the bundled snapshot. The live
 * registry does not publish them; without the Android package the QR cannot be shared to the bank app.
 */
export function withSnapshotLaunch(dto: BankAppDto, snapshot: BankAppsResponse = SNAPSHOT): BankAppDto {
  if (dto.android_package && dto.ios_scheme) return dto;
  const known = snapshot.apps.find((a) => a.app_id === dto.app_id);
  if (!known) return dto;
  return {
    ...dto,
    ios_scheme: dto.ios_scheme ?? known.ios_scheme,
    android_package: dto.android_package ?? known.android_package,
  };
}

export function registryPayApps(platform: Platform, data: BankAppsResponse = SNAPSHOT): PayApp[] {
  return data.apps.map((a) => toPayApp(withSnapshotLaunch(a), platform));
}
