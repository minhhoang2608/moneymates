import { generateVietQr } from "../vietqr/generate";

export type QrAccount = { bank_bin: string; account_no: string; account_name: string };

/** Static VietQR for a receiving account: no amount. */
export function accountQrPayload(a: QrAccount): string {
  return generateVietQr({ bankBin: a.bank_bin, account: a.account_no, name: a.account_name });
}
