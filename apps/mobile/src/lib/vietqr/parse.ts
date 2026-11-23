import { hasValidCrc } from "./crc16";
import { findBankByBin } from "./banks";
import { decodeTlv } from "./tlv";

export type ParseVietQrResult =
  | {
      kind: "vietqr";
      bankBin: string;
      bankName: string;
      account: string;
      name?: string;
      amount?: number;
      message?: string;
      isDynamic: boolean;
    }
  | { kind: "other"; amount?: number }
  | { kind: "invalid"; reason: "malformed" | "crc_mismatch" };

const MALFORMED: ParseVietQrResult = { kind: "invalid", reason: "malformed" };
const NAPAS_GUID = "A000000727";

/** Parse a scanned QR payload. Never throws. */
export function parseVietQr(text: unknown): ParseVietQrResult {
  if (typeof text !== "string") return MALFORMED;
  const payload = text.trim();
  if (!payload) return MALFORMED;

  const top = decodeTlv(payload);
  if (!top.ok) return MALFORMED;
  const f = top.fields;
  if (f.get("00") !== "01") return MALFORMED;
  const crc = f.get("63");
  if (crc === undefined || crc.length !== 4 || !payload.endsWith(`6304${crc}`)) return MALFORMED;
  if (!hasValidCrc(payload)) return { kind: "invalid", reason: "crc_mismatch" };

  let amount: number | undefined;
  const rawAmount = f.get("54");
  if (rawAmount !== undefined) {
    const n = Number(rawAmount);
    if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(n) || n <= 0) return MALFORMED;
    amount = n;
  }

  const t38 = f.get("38");
  const d38 = t38 !== undefined ? decodeTlv(t38) : undefined;
  if (d38?.ok && d38.fields.get("00") === NAPAS_GUID) {
    const sub = decodeTlv(d38.fields.get("01") ?? "");
    const bankBin = sub.ok ? sub.fields.get("00") : undefined;
    const account = sub.ok ? sub.fields.get("01") : undefined;
    if (bankBin && /^\d{6}$/.test(bankBin) && account) {
      const t62 = f.get("62");
      const d62 = t62 !== undefined ? decodeTlv(t62) : undefined;
      const result: ParseVietQrResult = {
        kind: "vietqr",
        bankBin,
        bankName: findBankByBin(bankBin)?.shortName ?? bankBin,
        account,
        isDynamic: f.get("01") === "12",
      };
      const name = f.get("59");
      if (name) result.name = name;
      if (amount !== undefined) result.amount = amount;
      const message = d62?.ok ? d62.fields.get("08") : undefined;
      if (message) result.message = message;
      return result;
    }
  }
  return amount !== undefined ? { kind: "other", amount } : { kind: "other" };
}
