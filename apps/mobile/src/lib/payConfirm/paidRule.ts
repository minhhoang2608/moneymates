import type { HandOffMethod, PaidSignal } from "../../db/schema";
import type { HandOffResult } from "./handOff";

/** Back in MoneyMates this long after the hand-off started = assume paid. */
export const PAID_AFTER_MS = 60_000;

export type ReturnEvaluation = { returned_at: string; paid_signal: PaidSignal | null };

/** The 60-second rule. An existing signal is never replaced (first signal wins). */
export function evaluateReturn(
  handOff: { started_at: string; paid_signal: PaidSignal | null },
  now: Date,
): ReturnEvaluation {
  const returned_at = now.toISOString();
  if (handOff.paid_signal) return { returned_at, paid_signal: handOff.paid_signal };
  const elapsed = now.getTime() - new Date(handOff.started_at).getTime();
  return { returned_at, paid_signal: elapsed >= PAID_AFTER_MS ? "time" : null };
}

/** Open-only and failed shares copy the account number today, so they count as `paste`. */
export function methodFromResult(result: Pick<HandOffResult, "mode" | "decision" | "share">): HandOffMethod {
  if (result.mode === "autofill") return "autofill";
  if (result.decision === "direct-share" && result.share === "shared") return "share";
  return "paste";
}
