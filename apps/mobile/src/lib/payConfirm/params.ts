export type PayConfirmModel = {
  kind: "vietqr" | "other";
  bankName: string;
  bankBin: string;
  account: string;
  name?: string;
  /** Integer VND from the QR, when present. */
  amount?: number;
  message?: string;
  isDynamic: boolean;
  /** The scanned QR string, stored as `qr_data`. */
  payload: string;
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Turn the string route params from /scan into a typed model. Bad input gives a safe "other" model. */
export function parsePayConfirmParams(params: Params): PayConfirmModel {
  const payload = (one(params.payload) ?? "").trim();
  const rawAmount = one(params.amount);
  const n = rawAmount !== undefined && /^\d+$/.test(rawAmount) ? Number(rawAmount) : NaN;
  const amount = Number.isSafeInteger(n) && n > 0 ? n : undefined;
  const bankName = one(params.bankName)?.trim() ?? "";
  const account = one(params.account)?.trim() ?? "";
  const isVietQr = one(params.kind) === "vietqr" && bankName !== "" && account !== "";
  if (!isVietQr) {
    return { kind: "other", bankName: "", bankBin: "", account: "", amount, isDynamic: false, payload };
  }
  return {
    kind: "vietqr",
    bankName,
    bankBin: one(params.bankBin)?.trim() ?? "",
    account,
    name: one(params.name)?.trim() || undefined,
    amount,
    message: one(params.message)?.trim() || undefined,
    isDynamic: one(params.isDynamic) === "1",
    payload,
  };
}
