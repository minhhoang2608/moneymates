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

/** `supportsAutofill` follows the VietQR registry (api.vietqr.io/v2/{android,ios}-app-deeplinks). */
export const PAY_APPS: PayApp[] = [
  {
    id: "tpbank",
    name: "TPBank",
    short: "TP",
    scheme: "hydro",
    androidPackage: "com.tpb.mb.gprsandroid",
    deeplinkCode: "tpb",
    supportsAutofill: false,
  },
  {
    id: "tcb",
    name: "Techcombank",
    short: "TCB",
    scheme: "tcb",
    androidPackage: "vn.com.techcombank.bb.app",
    deeplinkCode: "tcb",
    supportsAutofill: false,
  },
  {
    id: "vcb",
    name: "Vietcombank",
    short: "VCB",
    scheme: "vietcombankmobile",
    androidPackage: "com.VCB",
    deeplinkCode: "vcb",
    supportsAutofill: false,
  },
  {
    id: "mb",
    name: "MBBank",
    short: "MB",
    scheme: "mbbank",
    androidPackage: "com.mbmobile",
    deeplinkCode: "mb",
    supportsAutofill: true,
  },
  {
    id: "momo",
    name: "MoMo",
    short: "MoMo",
    scheme: "momo",
    androidPackage: "com.mservice.momotransfer",
    deeplinkCode: "momo",
    supportsAutofill: false,
  },
  {
    id: "icb",
    name: "VietinBank",
    short: "ICB",
    scheme: "vietinbankipay",
    androidPackage: "com.vietinbank.ipay",
    deeplinkCode: "icb",
    supportsAutofill: true,
  },
  { id: "bidv", name: "BIDV", short: "BIDV", deeplinkCode: "bidv", supportsAutofill: true },
  { id: "acb", name: "ACB", short: "ACB", deeplinkCode: "acb", supportsAutofill: true },
  { id: "ocb", name: "OCB", short: "OCB", deeplinkCode: "ocb", supportsAutofill: true },
];

const BIN_TO_APP: Record<string, string> = {
  "970423": "tpbank",
  "970407": "tcb",
  "970436": "vcb",
  "970422": "mb",
  "970415": "icb",
  "970418": "bidv",
  "970416": "acb",
  "970448": "ocb",
};

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
  const byBin = scannedBin ? BIN_TO_APP[scannedBin] : undefined;
  return ordered.find((a) => a.id === byBin)?.id ?? ordered.find((a) => a.supportsAutofill)?.id ?? ordered[0].id;
}
