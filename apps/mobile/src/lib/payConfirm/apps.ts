import { Platform } from "react-native";

import { SNAPSHOT, registryPayApps } from "../vietqr/bankApps";

export type PayApp = {
  id: string;
  name: string;
  short: string;
  /** Custom URL scheme used to open the app directly (no browser). Unknown for some autofill apps. */
  scheme?: string;
  /** Android package name (data only). */
  androidPackage?: string;
  /** VietQR deeplink app code (dl.vietqr.io). */
  deeplinkCode: string;
  /** true: dl.vietqr.io opens the app with the transfer prefilled ("Tự điền"). false: scan the saved QR image. */
  supportsAutofill: boolean;
};

const platform = Platform.OS === "ios" ? "ios" : "android";

const MOMO: PayApp = {
  id: "momo",
  name: "MoMo",
  short: "MoMo",
  scheme: "momo",
  androidPackage: "com.mservice.momotransfer",
  deeplinkCode: "momo",
  supportsAutofill: false,
};

/** Bank apps from the bundled VietQR registry snapshot, plus MoMo (a wallet, not in the bank registry). */
export const PAY_APPS: PayApp[] = [...registryPayApps(platform), MOMO];

/** Apps shown in the Cài đặt reorder list: the hand-off apps verified in #206 plus MoMo. */
export const FEATURED_APP_IDS = ["tpb", "tcb", "vcb", "mb", "momo", "icb", "bidv", "acb", "ocb"];

/** Ids saved by earlier versions. */
export const LEGACY_APP_IDS: Record<string, string> = { tpbank: "tpb" };

export const normalizeAppId = (id: string): string => LEGACY_APP_IDS[id] ?? id;

const BIN_TO_APP: Record<string, string> = Object.fromEntries(
  SNAPSHOT.apps.filter((a) => a.bin).map((a) => [a.bin as string, a.app_id]),
);

export const appIdForBin = (bin?: string): string | undefined => (bin ? BIN_TO_APP[bin] : undefined);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/** Case- and diacritic-insensitive match on name, bank code or app id. Blank query returns everything. */
export function filterApps(apps: PayApp[], query: string): PayApp[] {
  const q = fold(query.trim());
  if (!q) return apps;
  return apps.filter((a) => [a.name, a.short, a.id].some((f) => fold(f).includes(q)));
}

/** Picker order: preferred (Cài đặt), then recent, then the scanned bank's app, then the rest by name. No duplicates. */
export function orderPickerApps(
  apps: PayApp[],
  opts: { preferred: string[]; recent: string[]; scannedBin?: string },
): PayApp[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: PayApp[] = [];
  const push = (id: string | undefined) => {
    const app = id ? byId.get(normalizeAppId(id)) : undefined;
    if (app && !seen.has(app.id)) {
      seen.add(app.id);
      out.push(app);
    }
  };
  opts.preferred.forEach(push);
  opts.recent.forEach(push);
  push(appIdForBin(opts.scannedBin));
  [...apps].sort((a, b) => a.name.localeCompare(b.name, "vi")).forEach((a) => push(a.id));
  return out;
}

/** Apps sorted by the saved keys; unknown keys are dropped, unsaved apps follow in catalogue order. */
export function orderAppsBySaved(apps: PayApp[], savedOrder: string[]): PayApp[] {
  const saved = savedOrder
    .map((key) => apps.find((a) => a.id === key))
    .filter((a, i, arr): a is PayApp => !!a && arr.indexOf(a) === i);
  return [...saved, ...apps.filter((a) => !saved.includes(a))];
}

/** Default selection: the most recent app, else the app of the scanned bank, else an autofill app, else the first. */
export function defaultAppId(ordered: PayApp[], recentIds: string[], scannedBin?: string): string {
  const lastUsed = recentIds.find((id) => ordered.some((a) => a.id === id));
  if (lastUsed) return lastUsed;
  const byBin = appIdForBin(scannedBin);
  return ordered.find((a) => a.id === byBin)?.id ?? ordered.find((a) => a.supportsAutofill)?.id ?? ordered[0].id;
}
