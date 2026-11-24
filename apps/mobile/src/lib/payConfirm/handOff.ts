import { decideQrStorage, type PhotoPermission, type QrStorage } from "../qrImage/decide";
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
  /** Saves the QR image to the MoneyMates album. Returns the asset id, or null when nothing was saved. */
  saveQrImage: () => Promise<SavedQr | null>;
};

export type SavedQr = { assetId: string; access: PhotoPermission["access"] };

export type HandOffInput = { model: PayConfirmModel; amount: number; note: string; knownResult?: KnownShareResult };

async function attempt<T>(step: () => Promise<T>): Promise<T | undefined> {
  try {
    return await step();
  } catch (e) {
    console.warn("hand-off step failed", e);
    return undefined;
  }
}

export type HandOffResult = {
  opened: boolean;
  /** autofill: dl.vietqr.io with the transfer prefilled. direct: the user scans / picks the saved QR. */
  mode: "autofill" | "direct";
  decision: HandOffDecision;
  /** Only for direct-share: whether the app accepted the QR image. */
  share?: "shared" | "share_failed";
  /** Where the QR image went: nowhere (autofill), the private cache (direct share) or the album. */
  qrStorage: QrStorage;
  /** Id of the album asset, only when the image was saved to the album. */
  qrAssetId?: string;
  photoAccess?: PhotoPermission["access"];
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
    let fellBack = false;
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
      if (url) return { opened: await open(url), mode: "autofill", decision, qrStorage: "none" };
      fellBack = true;
      decision = app.androidPackage && deps.platform === "android" ? "direct-share" : "open-only";
    }
    if (model.kind === "vietqr") await attempt(() => deps.setClipboard(model.account));
    // Autofill fell back to a direct hand-off, which still needs an image (album unless direct-share is known to work).
    const storage: QrStorage = fellBack
      ? decision === "direct-share" && input.knownResult === "share_ok"
        ? "cache"
        : "album"
      : decideQrStorage({ platform: deps.platform, app, bankAcceptsDirectShare: input.knownResult === "share_ok" });
    const saved = storage === "album" ? await attempt(deps.saveQrImage) : undefined;
    const qr = { qrStorage: storage, qrAssetId: saved?.assetId, photoAccess: saved?.access };

    if (decision === "direct-share" && app.androidPackage) {
      try {
        await deps.shareToPackage(app.androidPackage);
        return { opened: true, mode: "direct", decision, share: "shared", ...qr };
      } catch (e) {
        console.warn("direct share failed", e);
        const opened = await openApp(app);
        return { opened, mode: "direct", decision, share: "share_failed", ...qr };
      }
    }
    return { opened: await openApp(app), mode: "direct", decision, ...qr };
  };
}
