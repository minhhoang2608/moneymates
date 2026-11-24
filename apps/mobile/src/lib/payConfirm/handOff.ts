import type { PayApp } from "./apps";
import { buildAutofillUrl, buildClipboardText, buildOpenUrl } from "./deeplink";
import type { PayConfirmModel } from "./params";

export type HandOffDeps = {
  openUrl: (url: string) => Promise<void>;
  setClipboard: (text: string) => Promise<void>;
  /** Saves the QR image to the photo library. */
  saveQrImage: () => Promise<void>;
};

export type HandOffInput = { model: PayConfirmModel; amount: number; note: string };

async function attempt(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (e) {
    console.warn("hand-off step failed", e);
  }
}

export type HandOffResult = {
  opened: boolean;
  /** autofill: dl.vietqr.io with the transfer prefilled. direct: scheme open, the user scans the saved QR. */
  mode: "autofill" | "direct";
};

/** Opens the chosen bank/wallet app. Never throws: `opened:false` tells the caller it failed. */
export function createHandOff(deps: HandOffDeps) {
  async function open(url: string, mode: HandOffResult["mode"]): Promise<HandOffResult> {
    try {
      await deps.openUrl(url);
      return { opened: true, mode };
    } catch (e) {
      console.warn("could not open bank app", e);
      return { opened: false, mode };
    }
  }

  return async function handOff(app: PayApp, input: HandOffInput): Promise<HandOffResult> {
    const { model, amount, note } = input;
    if (app.supportsAutofill && model.kind === "vietqr") {
      const url = buildAutofillUrl(app, {
        account: model.account,
        bin: model.bankBin,
        amount,
        message: note,
        name: model.name,
      });
      if (url) return open(url, "autofill");
    }
    if (model.kind === "vietqr") {
      await attempt(() => deps.setClipboard(buildClipboardText({ account: model.account, amount, message: note })));
    }
    await attempt(deps.saveQrImage);
    return open(buildOpenUrl(app), "direct");
  };
}
