import { Platform } from "react-native";

import { SNAPSHOT, registryPayApps, type BankAppsResponse } from "../vietqr/bankApps";

export type PayApp = {
  id: string;
  /** Bank app or e-wallet. */
  type: "bank" | "wallet";
  name: string;
  short: string;
  /** NAPAS BIN of the bank, when the registry knows it. */
  bin?: string;
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
  type: "wallet",
  name: "MoMo",
  short: "MoMo",
  scheme: "momo",
  androidPackage: "com.mservice.momotransfer",
  deeplinkCode: "momo",
  supportsAutofill: false,
};

/**
 * E-wallets, in display order. ZaloPay and VNPay have no scheme/package on purpose: the values are not guessed
 * and are added once verified on a real phone (see #101). They are always handed off by scanning the QR image.
 */
export const WALLET_APPS: PayApp[] = [
  MOMO,
  {
    id: "zalopay",
    type: "wallet",
    name: "ZaloPay",
    short: "ZaloPay",
    deeplinkCode: "zalopay",
    supportsAutofill: false,
  },
  { id: "vnpay", type: "wallet", name: "VNPay", short: "VNPay", deeplinkCode: "vnpay", supportsAutofill: false },
];

/** Bank apps from the bundled VietQR registry snapshot, plus the e-wallets (not in the bank registry). */
export function buildPayApps(data: BankAppsResponse, os: "android" | "ios" = platform): PayApp[] {
  const apps = registryPayApps(os, data);
  return [...apps, ...WALLET_APPS.filter((w) => !apps.some((a) => a.id === w.id))];
}

export const PAY_APPS: PayApp[] = buildPayApps(SNAPSHOT);

/** Apps shown in the Cài đặt reorder list: the hand-off apps verified in #206 plus MoMo. */
export const FEATURED_APP_IDS = ["tpb", "tcb", "vcb", "mb", "momo", "icb", "bidv", "acb", "ocb"];

/** The default enabled list before detection existed. */
export const DEFAULT_ENABLED_APP_IDS = FEATURED_APP_IDS;

/** Ids saved by earlier versions. */
export const LEGACY_APP_IDS: Record<string, string> = { tpbank: "tpb" };

export const normalizeAppId = (id: string): string => LEGACY_APP_IDS[id] ?? id;

/** App id of the bank with this BIN, looked up in the given list (default: the snapshot). */
export const appIdForBin = (bin?: string, apps: PayApp[] = PAY_APPS): string | undefined =>
  bin ? apps.find((a) => a.bin === bin)?.id : undefined;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/** Case- and diacritic-insensitive match on name, bank code or app id. Blank query returns everything. Ignores enabled state. */
export function searchApps(apps: PayApp[], query: string): PayApp[] {
  const q = fold(query.trim());
  if (!q) return apps;
  return apps.filter((a) => [a.name, a.short, a.id].some((f) => fold(f).includes(q)));
}

export const filterApps = searchApps;

/** Splits into banks and wallets, keeping the input order. */
export function groupApps(apps: PayApp[]): { banks: PayApp[]; wallets: PayApp[] } {
  return {
    banks: apps.filter((a) => a.type === "bank"),
    wallets: apps.filter((a) => a.type === "wallet"),
  };
}

/** Badge for the app row: "autofill" (Tự điền) or "scan" (Quét ảnh QR). */
export const badgeKind = (app: PayApp): "autofill" | "scan" => (app.supportsAutofill ? "autofill" : "scan");

/** Default enabled apps: the detected installed ones (catalogue order), or the legacy default when none match. */
export function defaultEnabled(
  installedIds: string[],
  legacyDefault: string[] = DEFAULT_ENABLED_APP_IDS,
  catalogue: PayApp[] = PAY_APPS,
): string[] {
  const installed = new Set(installedIds.map(normalizeAppId));
  const ids = catalogue.filter((a) => installed.has(a.id)).map((a) => a.id);
  return ids.length > 0 ? ids : [...legacyDefault];
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
  push(appIdForBin(opts.scannedBin, apps));
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
  const byBin = appIdForBin(scannedBin, ordered);
  return ordered.find((a) => a.id === byBin)?.id ?? ordered.find((a) => a.supportsAutofill)?.id ?? ordered[0].id;
}
