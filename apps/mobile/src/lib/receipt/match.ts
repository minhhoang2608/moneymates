import { parseVietQr } from "../vietqr";

import { fold } from "./fields";
import type { ParsedReceipt } from "./rules";

export const MATCH_WINDOW_MS = 30 * 60 * 1000;

export type PendingHandOff = {
  handOffId: string;
  /** ISO UTC. */
  startedAt: string;
  amount: number;
  accountNumber: string | null;
  recipientName: string | null;
  paidSignal: string | null;
};

type CandidateRow = {
  handOff: { id: string; started_at: string; paid_signal: string | null };
  amount: number;
  qr_data: string | null;
};

export function toPendingHandOff(row: CandidateRow): PendingHandOff {
  const qr = row.qr_data ? parseVietQr(row.qr_data) : null;
  const vietqr = qr && qr.kind === "vietqr" ? qr : null;
  return {
    handOffId: row.handOff.id,
    startedAt: row.handOff.started_at,
    amount: row.amount,
    accountNumber: vietqr?.account ?? null,
    recipientName: vietqr?.name ?? null,
    paidSignal: row.handOff.paid_signal,
  };
}

const digits = (s: string) => s.replace(/\D/g, "");
const nameKey = (s: string) => fold(s).trim().replace(/\s+/g, " ");

function sameParty(parsed: ParsedReceipt, p: PendingHandOff): boolean {
  if (parsed.accountNumber && p.accountNumber) {
    const a = digits(parsed.accountNumber);
    if (a && a === digits(p.accountNumber)) return true;
  }
  if (parsed.recipient && p.recipientName) {
    const a = nameKey(parsed.recipient);
    if (a && a === nameKey(p.recipientName)) return true;
  }
  return false;
}

/** The pending hand-off a receipt belongs to: same amount, same account or name, started in the last 30 min. */
export function matchReceipt(parsed: ParsedReceipt, pending: PendingHandOff[], now: Date): PendingHandOff | null {
  if (parsed.amount === null) return null;
  const t = now.getTime();
  let best: PendingHandOff | null = null;
  let bestAt = -Infinity;
  for (const p of pending) {
    if (p.paidSignal === "receipt" || p.amount !== parsed.amount) continue;
    const started = Date.parse(p.startedAt);
    if (Number.isNaN(started) || started > t || started < t - MATCH_WINDOW_MS) continue;
    if (!sameParty(parsed, p)) continue;
    if (started > bestAt) {
      best = p;
      bestAt = started;
    }
  }
  return best;
}
