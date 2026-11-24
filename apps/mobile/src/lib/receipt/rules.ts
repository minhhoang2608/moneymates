import {
  extractAmount,
  extractBankAccount,
  extractPaidAt,
  extractTransactionId,
  fold,
  normaliseAccount,
} from "./fields";
import { findBankByName } from "../vietqr/banks";

export type ParsedReceipt = {
  amount: number | null;
  recipient: string | null;
  bankName: string | null;
  accountNumber: string | null;
  message: string | null;
  paidAt: string | null;
  transactionId: string | null;
};

export type ReceiptRule = {
  id: string;
  detect: (lines: string[]) => boolean;
  parse: (lines: string[]) => Partial<ParsedReceipt>;
};

export const EMPTY_RECEIPT: ParsedReceipt = {
  amount: null,
  recipient: null,
  bankName: null,
  accountNumber: null,
  message: null,
  paidAt: null,
  transactionId: null,
};

type LabelKey = "amount" | "recipient" | "bank" | "account" | "message" | "time" | "txid";

const LABELS: Record<LabelKey, string[]> = {
  amount: ["so tien giao dich", "so tien"],
  recipient: ["ten nguoi nhan", "nguoi nhan", "ten tai khoan nhan", "ten nguoi thu huong"],
  bank: ["ngan hang nhan", "ngan hang"],
  account: ["tai khoan nhan", "so tai khoan nhan", "so tai khoan", "stk"],
  message: ["noi dung chuyen khoan", "noi dung", "loi nhan"],
  time: ["thoi gian giao dich", "thoi gian", "ngay gio giao dich", "ngay gio"],
  txid: ["ma giao dich", "ma gd", "so tham chieu", "ref"],
};

/** Returns the label key and the text after the label on the same line ("" if none). */
function matchLabel(line: string): { key: LabelKey; rest: string } | null {
  const colon = line.indexOf(":");
  const head = fold(colon >= 0 ? line.slice(0, colon) : line).trim();
  for (const key of Object.keys(LABELS) as LabelKey[]) {
    if (LABELS[key].includes(head)) return { key, rest: colon >= 0 ? line.slice(colon + 1).trim() : "" };
  }
  return null;
}

export function normaliseLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.normalize("NFC").replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
}

function labelledValues(lines: string[]): Partial<Record<LabelKey, string>> {
  const out: Partial<Record<LabelKey, string>> = {};
  lines.forEach((line, i) => {
    const m = matchLabel(line);
    if (!m || out[m.key] !== undefined) return;
    let value = m.rest;
    if (!value && i + 1 < lines.length && !matchLabel(lines[i + 1])) value = lines[i + 1];
    if (value) out[m.key] = value;
  });
  return out;
}

function labelledPass(lines: string[]): Partial<ParsedReceipt> {
  const v = labelledValues(lines);
  const out: Partial<ParsedReceipt> = {};
  if (v.amount) out.amount = extractAmount(v.amount);
  if (v.recipient) out.recipient = v.recipient;
  if (v.message) out.message = v.message;
  if (v.time) out.paidAt = extractPaidAt(v.time);
  if (v.txid) out.transactionId = extractTransactionId(v.txid);
  if (v.bank) out.bankName = findBankByName(v.bank)?.shortName ?? null;
  if (v.account) {
    const ba = extractBankAccount(v.account);
    if (ba) {
      out.accountNumber = ba.accountNumber;
      if (ba.bankName) out.bankName = ba.bankName;
    } else {
      out.accountNumber = normaliseAccount(v.account);
    }
  }
  return out;
}

const CURRENCY_AMOUNT = /(\d[\d.,\s]*\d|\d)\s*(?:vn[dđ]|[đ₫])/i;

function currencyAmountLine(lines: string[]): number {
  return lines.findIndex((l) => {
    const m = CURRENCY_AMOUNT.exec(l);
    return m !== null && extractAmount(m[1]) !== null;
  });
}

function amountFromLine(line: string): number | null {
  const m = CURRENCY_AMOUNT.exec(line);
  return m ? extractAmount(m[1]) : null;
}

function bankAccountLine(lines: string[], bank?: string): number {
  return lines.findIndex((l) => {
    const ba = extractBankAccount(l);
    return ba !== null && (bank === undefined || ba.bankName === bank);
  });
}

function dropNull(p: Partial<ParsedReceipt>): Partial<ParsedReceipt> {
  const out: Partial<ParsedReceipt> = {};
  for (const k of Object.keys(p) as (keyof ParsedReceipt)[]) {
    if (p[k] !== null && p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  }
  return out;
}

export const genericRule: ReceiptRule = {
  id: "generic",
  detect: () => true,
  parse(lines) {
    const out: Partial<ParsedReceipt> = dropNull(labelledPass(lines));
    if (out.amount === undefined) {
      const i = currencyAmountLine(lines);
      if (i >= 0) out.amount = amountFromLine(lines[i]) ?? undefined;
    }
    if (out.accountNumber === undefined) {
      const i = bankAccountLine(lines);
      if (i >= 0) {
        const ba = extractBankAccount(lines[i]);
        if (ba) {
          out.accountNumber = ba.accountNumber ?? undefined;
          if (out.bankName === undefined && ba.bankName) out.bankName = ba.bankName;
        }
      }
    }
    if (out.paidAt === undefined) {
      for (const l of lines) {
        const t = extractPaidAt(l);
        if (t) {
          out.paidAt = t;
          break;
        }
      }
    }
    if (out.transactionId === undefined) {
      for (const l of lines) {
        const t = /\bFT[0-9A-Z]{8,}\b/.exec(l);
        if (t) {
          out.transactionId = t[0];
          break;
        }
      }
    }
    return dropNull(out);
  },
};

function isAllCapsName(line: string): boolean {
  return /\p{L}/u.test(line) && !/\d/.test(line) && line === line.toUpperCase() && line.length >= 2;
}

function isStructural(line: string): boolean {
  return (
    matchLabel(line) !== null ||
    extractPaidAt(line) !== null ||
    extractBankAccount(line) !== null ||
    amountFromLine(line) !== null
  );
}

export const tpbankRule: ReceiptRule = {
  id: "tpbank",
  detect: (lines) => lines.some((l) => /\btpb(?:ank)?\b/i.test(l)),
  parse(lines) {
    const out: Partial<ParsedReceipt> = dropNull(labelledPass(lines));
    const a = currencyAmountLine(lines);
    if (out.amount === undefined && a >= 0) out.amount = amountFromLine(lines[a]) ?? undefined;

    const acc = bankAccountLine(lines, "TPBank");
    if (acc >= 0) {
      const ba = extractBankAccount(lines[acc]);
      if (ba) {
        if (out.bankName === undefined) out.bankName = "TPBank";
        if (out.accountNumber === undefined) out.accountNumber = ba.accountNumber ?? undefined;
      }
      if (out.recipient === undefined && a >= 0 && a < acc) {
        const r = lines.slice(a + 1, acc).filter((l) => isAllCapsName(l) && !isStructural(l));
        if (r.length === 1) out.recipient = r[0];
      }
      if (out.message === undefined) {
        const next = lines.slice(acc + 1).find((l) => !isStructural(l) && extractTransactionId(l) === null);
        if (next) out.message = next;
      }
    }
    return dropNull(out);
  },
};

export const RECEIPT_RULES: ReceiptRule[] = [tpbankRule];
