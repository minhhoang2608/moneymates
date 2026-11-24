export type PayApp = {
  id: string;
  name: string;
  short: string;
  /** Custom URL scheme used to open the app directly (no browser hop). */
  scheme: string;
  /** Android package name (data only: docs and `<queries>`). */
  androidPackage?: string;
};

export const PAY_APPS: PayApp[] = [
  { id: "tpbank", name: "TPBank", short: "TP", scheme: "hydro", androidPackage: "com.tpb.mb.gprsandroid" },
  { id: "tcb", name: "Techcombank", short: "TCB", scheme: "tcb", androidPackage: "vn.com.techcombank.bb.app" },
  { id: "vcb", name: "Vietcombank", short: "VCB", scheme: "vietcombankmobile", androidPackage: "com.VCB" },
  { id: "mb", name: "MBBank", short: "MB", scheme: "mbbank", androidPackage: "com.mbmobile" },
  { id: "momo", name: "MoMo", short: "MoMo", scheme: "momo", androidPackage: "com.mservice.momotransfer" },
  { id: "icb", name: "VietinBank", short: "ICB", scheme: "vietinbankipay", androidPackage: "com.vietinbank.ipay" },
];

const BIN_TO_APP: Record<string, string> = {
  "970423": "tpbank",
  "970407": "tcb",
  "970436": "vcb",
  "970422": "mb",
  "970415": "icb",
};

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
