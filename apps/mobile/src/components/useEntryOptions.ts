import { useAiAvailable, useRefreshFeatures } from "@/api/features";
import { vi } from "@/i18n/vi";

/** Availability of the Voice and Chụp bill entry points; shared by the "+" menu and the Tổng quan buttons. */
export function useEntryOptions() {
  const refreshFeatures = useRefreshFeatures();
  const bill = useAiAvailable("parse_bill");
  const voiceAvailable = useAiAvailable("parse_text").available;
  const billAvailable = bill.available;
  // Chụp bill is never greyed out for good: while the AI is not confirmed available, a tap re-checks the server
  // and the entry says why. Voice also works offline (rules only), so it is never gated on AI.
  const billHint = billAvailable
    ? null
    : bill.reason === "loading"
      ? vi.entryMenu.billChecking
      : bill.reason === "disabled"
        ? vi.entryMenu.billDisabled
        : vi.entryMenu.billRetry(
            vi.apiErrors[bill.errorCode === "unknown" || !bill.errorCode ? "network" : bill.errorCode],
            bill.errorCode ?? "?",
          );
  const voiceHint = voiceAvailable ? null : vi.voice.offlineHint;
  /** Wraps the bill handler: opens it when the AI is available, otherwise re-checks the server. */
  const wrapBill = (onBill: (() => void) | undefined) =>
    onBill ? (billAvailable ? onBill : () => refreshFeatures(true)) : undefined;
  return { refreshFeatures, billAvailable, billHint, voiceHint, wrapBill };
}
