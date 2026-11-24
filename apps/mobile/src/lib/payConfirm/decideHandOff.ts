import type { PayApp } from "./apps";

export type HandOffPlatform = "android" | "ios";
/** What the user last reported about sharing the QR straight to this app. */
export type KnownShareResult = "share_ok" | "share_failed";
export type HandOffDecision = "autofill-link" | "direct-share" | "open-only";

/** Picks how to hand the payment to a bank/wallet app. Pure. */
export function decideHandOff(app: PayApp, platform: HandOffPlatform, known?: KnownShareResult): HandOffDecision {
  if (app.supportsAutofill) return "autofill-link";
  if (platform === "android" && app.androidPackage && known !== "share_failed") return "direct-share";
  return "open-only";
}
