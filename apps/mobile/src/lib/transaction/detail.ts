import { dayKeyOf, timeOf } from "@/lib/history";
import { findBankByBin, parseVietQr } from "@/lib/vietqr";

/** "dd/MM/yyyy, HH:mm" in Vietnam local time (UTC+7). */
export function formatDetailDateTime(isoUtc: string): string {
  const [y, m, d] = dayKeyOf(isoUtc).split("-");
  return `${d}/${m}/${y}, ${timeOf(isoUtc)}`;
}

export type QrDetails = { payee: string; bank: string; message: string };

/** Payee, bank and message of a stored VietQR payload; null when it is missing or not a VietQR. */
export function qrDetails(qrData: string | null | undefined): QrDetails | null {
  if (!qrData) return null;
  const r = parseVietQr(qrData);
  if (r.kind !== "vietqr") return null;
  const bank = findBankByBin(r.bankBin)?.shortName ?? r.bankName;
  return { payee: r.name ? `${r.name} · ${r.account}` : r.account, bank, message: r.message ?? "" };
}
