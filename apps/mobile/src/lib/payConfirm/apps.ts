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

/** Apps sorted by the saved keys; unknown keys are dropped, unsaved apps follow in catalogue order. */
export function orderAppsBySaved(apps: PayApp[], savedOrder: string[]): PayApp[] {
  const saved = savedOrder
    .map((key) => apps.find((a) => a.id === key))
    .filter((a, i, arr): a is PayApp => !!a && arr.indexOf(a) === i);
  return [...saved, ...apps.filter((a) => !saved.includes(a))];
}

/** Default selection: the most recent app, else the app of the scanned bank, else the first. */
export function defaultAppId(ordered: PayApp[], recentIds: string[], scannedBin?: string): string {
  const lastUsed = recentIds.find((id) => ordered.some((a) => a.id === id));
  if (lastUsed) return lastUsed;
  const byBin = scannedBin ? BIN_TO_APP[scannedBin] : undefined;
  return ordered.find((a) => a.id === byBin)?.id ?? ordered[0].id;
}
