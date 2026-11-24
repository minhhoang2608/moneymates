import { PAY_APPS, appIdForBin, normalizeAppId, searchApps, type PayApp } from "./apps";

/** QR bank BIN (VietQR tag 38 acquirer, same key as `appIdForBin`) -> id of the app last used for that bank. */
export type LastUsedByBank = Record<string, string>;

export type PickerRow = { app: PayApp; isQrBank: boolean; isRecent: boolean };

/** Returns a new map with `appId` remembered for `qrBin`. A blank BIN or app id changes nothing. */
export function recordLastUsed(map: LastUsedByBank, qrBin: string, appId: string): LastUsedByBank {
  if (!qrBin || !qrBin.trim() || !appId) return { ...map };
  return { ...map, [qrBin]: normalizeAppId(appId) };
}

const known = (id: string, catalogue: PayApp[]): string | undefined => {
  const n = normalizeAppId(id);
  return catalogue.some((a) => a.id === n) ? n : undefined;
};

/**
 * App to preselect for a scanned QR: 1) the app last used for this bank (if it is enabled or is the QR bank's app),
 * 2) the QR bank's own app, even when disabled, 3) the first enabled app, else undefined.
 */
export function preselectApp(
  qrBankId: string | undefined,
  enabledApps: string[],
  lastUsedByBank: LastUsedByBank,
  catalogue: PayApp[] = PAY_APPS,
): string | undefined {
  const enabled = enabledApps.map(normalizeAppId);
  const bankApp = appIdForBin(qrBankId, catalogue);
  const last = qrBankId && lastUsedByBank[qrBankId] ? known(lastUsedByBank[qrBankId], catalogue) : undefined;
  if (last && (last === bankApp || enabled.includes(last))) return last;
  if (bankApp) return bankApp;
  return enabled.find((id) => catalogue.some((a) => a.id === id));
}

/**
 * Rows for the app picker. Blank query: the QR bank's app (even if disabled) first, then recent enabled apps, then the
 * other enabled apps in saved order. Non-blank query: search over the whole catalogue (disabled apps included),
 * QR bank / enabled rows first, then the rest in catalogue order.
 */
export function pickerApps(
  enabledApps: string[],
  qrBankId: string | undefined,
  recentIds: string[],
  query: string,
  catalogue: PayApp[] = PAY_APPS,
): PickerRow[] {
  const byId = new Map(catalogue.map((a) => [a.id, a]));
  const enabled = enabledApps.map(normalizeAppId);
  const recent = new Set(recentIds.map(normalizeAppId));
  const bankId = appIdForBin(qrBankId, catalogue);
  const row = (app: PayApp): PickerRow => ({ app, isQrBank: app.id === bankId, isRecent: recent.has(app.id) });
  const seen = new Set<string>();
  const out: PickerRow[] = [];
  const push = (app: PayApp | undefined) => {
    if (app && !seen.has(app.id)) {
      seen.add(app.id);
      out.push(row(app));
    }
  };

  if (!query.trim()) {
    push(bankId ? byId.get(bankId) : undefined);
    enabled.filter((id) => recent.has(id)).forEach((id) => push(byId.get(id)));
    enabled.forEach((id) => push(byId.get(id)));
    return out;
  }
  const matches = searchApps(catalogue, query);
  const inMatches = (id: string | undefined) => matches.find((a) => a.id === id);
  push(inMatches(bankId));
  enabled.filter((id) => recent.has(id)).forEach((id) => push(inMatches(id)));
  enabled.forEach((id) => push(inMatches(id)));
  matches.forEach(push);
  return out;
}
