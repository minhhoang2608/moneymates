import { parseAmount } from "../money";
import { findBankByName } from "../vietqr/banks";

/** Lowercase, diacritic-free form used for label matching. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
}

const CURRENCY = /vn[dđ]|[đ₫]/g;

/** "55.000 VND", "55,000đ", "-1.250.000" -> integer VND, or null. Never returns a float. */
export function extractAmount(text: string): number | null {
  const cleaned = text
    .normalize("NFC")
    .toLowerCase()
    .replace(CURRENCY, "")
    .replace(/[+\-−–]/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;
  const result = parseAmount(cleaned);
  return result.ok ? result.vnd : null;
}

/** Digits only, 6-19 digits, else null. */
export function normaliseAccount(text: string): string | null {
  const digits = text.replace(/[\s.\-]/g, "");
  if (!/^\d{6,19}$/.test(digits)) return null;
  return digits;
}

const BANK_ACCOUNT = /^(.*?)\s*[-–·•|]\s*(\d[\d ]{4,})$/u;

/** "<Bank> - <digits>" -> bank short name (null when unknown) and account number. */
export function extractBankAccount(line: string): { bankName: string | null; accountNumber: string | null } | null {
  const m = BANK_ACCOUNT.exec(line.trim());
  if (!m) return null;
  const accountNumber = normaliseAccount(m[2]);
  if (!accountNumber) return null;
  const bank = m[1].trim() ? findBankByName(m[1].trim()) : undefined;
  return { bankName: bank ? bank.shortName : null, accountNumber };
}

const TIME_FIRST = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const DATE_FIRST = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/**
 * Receipts show Vietnam local time (UTC+7); the result is an ISO UTC string.
 * Invalid dates return null.
 */
export function extractPaidAt(text: string): string | null {
  let parts: number[] | null = null;
  const a = TIME_FIRST.exec(text);
  if (a) {
    parts = [a[6], a[5], a[4], a[1], a[2], a[3] ?? "0"].map(Number);
  } else {
    const b = DATE_FIRST.exec(text);
    if (b) parts = [b[3], b[2], b[1], b[4], b[5], b[6] ?? "0"].map(Number);
  }
  if (!parts) return null;
  const [y, mo, d, h, mi, s] = parts;
  if (h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h - 7, mi, s));
  const local = new Date(Date.UTC(y, mo - 1, d));
  if (local.getUTCMonth() !== mo - 1 || local.getUTCDate() !== d) return null;
  return date.toISOString();
}

const TX_LABEL = /(?:ma giao dich|ma gd|so tham chieu|ref)\s*[:.]?\s*([a-z0-9]{6,})/i;
const TX_TOKEN = /\bFT[0-9A-Z]{8,}\b/;

export function extractTransactionId(text: string): string | null {
  const folded = fold(text);
  const m = TX_LABEL.exec(folded);
  if (m) {
    // Keep the original casing of the matched token.
    const idx = folded.indexOf(m[1], m.index);
    return text.slice(idx, idx + m[1].length);
  }
  const bare = text.trim();
  if (/^[A-Za-z0-9]{6,}$/.test(bare) && /\d/.test(bare)) return bare;
  const t = TX_TOKEN.exec(text);
  return t ? t[0] : null;
}
