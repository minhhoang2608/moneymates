import { parseSignedVnd } from "./amount";
import type { BankNotification, BankRule } from "./types";

const SIGNED_AMOUNT = /([+\-−]\d[\d.,]*)\s*(?:VND|VNĐ|đ|₫)/iu;
const ANY_AMOUNT = /(\d[\d.,]*)\s*(?:VND|VNĐ|đ|₫)/iu;
const ACCOUNT = /(?:TK|STK|Tài khoản)(?:\s+[A-Z]{3,})?\s*:?\s*[x*.…]*\s*(\d{3,})/iu;
const MESSAGE = /(?:ND|Nội dung|Lời nhắn)\s*:\s*(.+)$/imu;
const NOISE = /\bOTP\b|mã xác thực|khuyến mãi|ưu đãi|voucher/iu;

export function normalise(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Text before the free-form message, so promo words in a transfer note do not matter. */
function head(text: string): string {
  const i = text.search(/(?:ND|Nội dung|Lời nhắn)\s*:/iu);
  return i >= 0 ? text.slice(0, i) : text;
}

export function isNoise(text: string): boolean {
  return NOISE.test(head(text));
}

export function extractAccountSuffix(text: string): string | undefined {
  const m = text.match(ACCOUNT);
  return m ? m[1].slice(-4) : undefined;
}

export function extractMessage(text: string): string | undefined {
  const m = text.match(MESSAGE);
  if (!m) return undefined;
  const msg = m[1]
    .replace(/\s*(?:Số dư|SD)\s*(?:cuối)?\s*:.*$/iu, "")
    .replace(/[.\s]+$/, "")
    .trim();
  return msg || undefined;
}

function build(direction: "out" | "in", vnd: number, text: string): BankNotification | null {
  if (vnd <= 0) return null;
  const n: BankNotification = { direction, amount: vnd };
  const suffix = extractAccountSuffix(text);
  if (suffix) n.accountSuffix = suffix;
  const message = extractMessage(text);
  if (message) n.message = message;
  return n;
}

/** Banks that print a signed amount: `-55,000 VND` or `+55,000 VND`. */
export function signedBankRule(packageNames: string[]): BankRule {
  return {
    packageNames,
    parse(title, rawText) {
      const text = normalise(`${rawText}`);
      if (!text || isNoise(text)) return null;
      const m = text.match(SIGNED_AMOUNT);
      if (!m) return null;
      const parsed = parseSignedVnd(m[1]);
      if (!parsed || !parsed.sign) return null;
      return build(parsed.sign === "+" ? "in" : "out", parsed.vnd, text);
    },
  };
}

/** Wallets that use words instead of a sign. */
export function keywordWalletRule(packageNames: string[], inWords: RegExp, outWords: RegExp): BankRule {
  return {
    packageNames,
    parse(title, rawText) {
      const text = normalise(`${rawText}`);
      if (!text || isNoise(text)) return null;
      const m = text.match(ANY_AMOUNT);
      if (!m) return null;
      const parsed = parseSignedVnd(m[1]);
      if (!parsed) return null;
      const body = head(text);
      const direction = inWords.test(body) ? "in" : outWords.test(body) ? "out" : null;
      return direction ? build(direction, parsed.vnd, text) : null;
    },
  };
}
