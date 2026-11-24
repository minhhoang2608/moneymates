import type { PayApp } from "./apps";
import { buildAutofillUrl, buildOpenCandidates } from "./deeplink";
import { decideHandOff, type HandOffDecision, type HandOffPlatform, type KnownShareResult } from "./decideHandOff";
import type { PayConfirmModel } from "./params";

export type HandOffDeps = {
  platform: HandOffPlatform;
  /** Opens a web/scheme URL. */
  openUrl: (url: string) => Promise<void>;
  /** Opens an Android `intent://` URL; rejects when the app is not installed. */
  openIntent: (url: string) => Promise<void>;
  /** Sends the QR PNG straight to an Android package; rejects when the app does not accept it. */
  shareToPackage: (pkg: string) => Promise<void>;
  setClipboard: (text: string) => Promise<void>;
  /** Saves the QR image to the MoneyMates album. */
  saveQrImage: () => Promise<void>;
};

export type HandOffInput = { model: PayConfirmModel; amount: number; note: string; knownResult?: KnownShareResult };

async function attempt(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (e) {
    console.warn("hand-off step failed", e);
  }
}

export type HandOffResult = {
  opened: boolean;
  /** autofill: dl.vietqr.io with the transfer prefilled. direct: the user scans / picks the saved QR. */
  mode: "autofill" | "direct";
  decision: HandOffDecision;
  /** Only for direct-share: whether the app accepted the QR image. */
  share?: "shared" | "share_failed";
};

/** Hands the payment to the chosen app. Never throws: `opened:false` tells the caller it failed. */
export function createHandOff(deps: HandOffDeps) {
  async function open(url: string): Promise<boolean> {
    try {
      if (deps.platform === "android" && url.startsWith("intent:")) await deps.openIntent(url);
      else await deps.openUrl(url);
      return true;
    } catch (e) {
      console.warn("could not open bank app", e);
      return false;
    }
  }

  /** Tries each way to open the app until one works. */
  async function openApp(app: PayApp): Promise<boolean> {
    for (const url of buildOpenCandidates(app, deps.platform)) {
      if (await open(url)) return true;
    }
    return false;
  }

  return async function handOff(app: PayApp, input: HandOffInput): Promise<HandOffResult> {
    const { model, amount, note } = input;
    let decision = decideHandOff(app, deps.platform, input.knownResult);
    if (decision === "autofill-link") {
      const url =
        model.kind === "vietqr"
          ? buildAutofillUrl(app, {
              account: model.account,
              bin: model.bankBin,
              amount,
              message: note,
              name: model.name,
            })
          : null;
      if (url) return { opened: await open(url), mode: "autofill", decision };
      decision = app.androidPackage && deps.platform === "android" ? "direct-share" : "open-only";
    }
    if (model.kind === "vietqr") await attempt(() => deps.setClipboard(model.account));
    await attempt(deps.saveQrImage);

    if (decision === "direct-share" && app.androidPackage) {
      try {
        await deps.shareToPackage(app.androidPackage);
        return { opened: true, mode: "direct", decision, share: "shared" };
      } catch (e) {
        console.warn("direct share failed", e);
        const opened = await openApp(app);
        return { opened, mode: "direct", decision, share: "share_failed" };
      }
    }
    return { opened: await openApp(app), mode: "direct", decision };
  };
}
