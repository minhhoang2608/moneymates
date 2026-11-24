import type { PayApp } from "./apps";
import { buildClipboardText, buildOpenUrl } from "./deeplink";
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

/** Opens the chosen bank/wallet app. Never throws: `opened:false` tells the caller it failed. */
export function createHandOff(deps: HandOffDeps) {
  return async function handOff(app: PayApp, input: HandOffInput): Promise<{ opened: boolean }> {
    const { model, amount, note } = input;
    const url = buildOpenUrl(app);
    if (model.kind === "vietqr") {
      await attempt(() => deps.setClipboard(buildClipboardText({ account: model.account, amount, message: note })));
    }
    await attempt(deps.saveQrImage);
    try {
      await deps.openUrl(url);
      return { opened: true };
    } catch (e) {
      console.warn("could not open bank app", e);
      return { opened: false };
    }
  };
}
