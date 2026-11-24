import { appIdForBin, normalizeAppId } from "./apps";

/** Apps that fill the transfer from the VietQR link, so no QR image has to be picked. */
export const AUTOFILL_DEFAULT_IDS = ["mb", "icb", "bidv", "acb", "ocb"];

export type SuggestionInput = {
  /** Current Cài đặt order (full list of app ids, first = default). */
  order: string[];
  /** Recently used app ids from hand-offs. */
  recent: string[];
  /** BINs of the user's own receiving accounts. */
  accountBins: string[];
  dismissed: boolean;
};

/** An autofill app to suggest as default, or null. Pure. */
export function suggestDefaultApp({ order, recent, accountBins, dismissed }: SuggestionInput): string | null {
  if (dismissed) return null;
  if (order[0] && AUTOFILL_DEFAULT_IDS.includes(order[0])) return null;
  const owned = new Set<string>(recent.map(normalizeAppId));
  for (const bin of accountBins) {
    const id = appIdForBin(bin);
    if (id) owned.add(id);
  }
  return AUTOFILL_DEFAULT_IDS.find((id) => owned.has(id)) ?? null;
}
