export type PayApp = {
  id: string;
  name: string;
  short: string;
  /** Custom URL scheme used to just open the app. */
  scheme: string;
  /** VietQR deeplink app code (dl.vietqr.io). */
  deeplinkCode: string;
  /** true: the app is opened with account, amount and message prefilled ("Tự điền"). */
  supportsAutofill: boolean;
};

/** Flags are data: flip `supportsAutofill` after real-device deeplink tests. */
export const PAY_APPS: PayApp[] = [
  { id: "tpbank", name: "TPBank", short: "TP", scheme: "tpbank", deeplinkCode: "tpb", supportsAutofill: true },
  { id: "tcb", name: "Techcombank", short: "TCB", scheme: "techcombank", deeplinkCode: "tcb", supportsAutofill: true },
  { id: "vcb", name: "Vietcombank", short: "VCB", scheme: "vcbpay", deeplinkCode: "vcb", supportsAutofill: false },
  { id: "mb", name: "MBBank", short: "MB", scheme: "mbbank", deeplinkCode: "mb", supportsAutofill: false },
  { id: "momo", name: "MoMo", short: "MoMo", scheme: "momo", deeplinkCode: "momo", supportsAutofill: false },
];

const BIN_TO_APP: Record<string, string> = { "970423": "tpbank", "970407": "tcb", "970436": "vcb", "970422": "mb" };

/** Recently used apps first (newest first), then the rest in catalogue order. */
export function orderApps(apps: PayApp[], recentIds: string[]): PayApp[] {
  const recent = recentIds
    .map((id) => apps.find((a) => a.id === id))
    .filter((a, i, arr): a is PayApp => !!a && arr.indexOf(a) === i);
  return [...recent, ...apps.filter((a) => !recent.includes(a))];
}

/** Default selection: the most recent app, else the app of the scanned bank, else the first. */
export function defaultAppId(ordered: PayApp[], recentIds: string[], scannedBin?: string): string {
  if (recentIds.includes(ordered[0].id)) return ordered[0].id;
  const byBin = scannedBin ? BIN_TO_APP[scannedBin] : undefined;
  return ordered.find((a) => a.id === byBin)?.id ?? ordered[0].id;
}
