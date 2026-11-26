import type { PayApp } from "./apps";

export type HandOffPlatform = "android" | "ios";
/** What we learned about sharing the QR straight to this app (share_ok comes from the paid signal). */
export type KnownShareResult = "share_ok" | "share_failed";
export type HandOffDecision = "autofill-link" | "direct-share" | "open-only";

/**
 * Picks how to hand the payment to a bank/wallet app. Pure. On Android a non-autofill app always gets the image
 * shared straight to it: a share that failed once is tried again next time, never switched off for good.
 */
export function decideHandOff(app: PayApp, platform: HandOffPlatform, _known?: KnownShareResult): HandOffDecision {
  if (app.supportsAutofill) return "autofill-link";
  if (platform === "android" && app.androidPackage) return "direct-share";
  return "open-only";
}
