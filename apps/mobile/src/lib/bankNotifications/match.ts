import type { BankNotification } from "./types";

export type ReceivedNotification = BankNotification & { packageName: string; postedAt?: number };

export type MatchableHandOff = {
  id: string;
  /** Integer VND. */
  amount: number;
  accountNumber?: string;
  message?: string;
  /** Epoch ms. */
  startedAt: number;
  paidSignal?: "time" | "notification" | "receipt" | null;
};

export const MATCH_WINDOW_MS = 30 * 60 * 1000;

function normalizeMessage(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function matchNotification(args: {
  notification: ReceivedNotification;
  handOffs: MatchableHandOff[];
  enabledPackages: string[];
  now: number;
}): string | null {
  const { notification: n, handOffs, enabledPackages, now } = args;
  if (!enabledPackages.includes(n.packageName)) return null;
  if (n.direction !== "out") return null;
  const t = n.postedAt ?? now;
  const nMsg = n.message ? normalizeMessage(n.message) : "";

  let best: MatchableHandOff | null = null;
  for (const h of handOffs) {
    if (h.paidSignal) continue;
    if (h.amount !== n.amount) continue;
    const dt = t - h.startedAt;
    if (dt < 0 || dt > MATCH_WINDOW_MS) continue;
    if (n.accountSuffix) {
      const digits = (h.accountNumber ?? "").replace(/\D/g, "");
      if (!digits || !digits.endsWith(n.accountSuffix)) continue;
    }
    if (nMsg) {
      if (!h.message || normalizeMessage(h.message) !== nMsg) continue;
    }
    if (!best || h.startedAt > best.startedAt) best = h;
  }
  return best ? best.id : null;
}
