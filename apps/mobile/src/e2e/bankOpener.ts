import type { HandOffDeps } from "@/lib/payConfirm/handOff";

export const openedUrls: string[] = [];

/** E2E mode: record the URL and stay in the app. */
export const e2eHandOffDeps: HandOffDeps = {
  openUrl: async (url) => {
    openedUrls.push(url);
    throw new Error("e2e: bank app not opened");
  },
  setClipboard: async () => {},
  saveQrImage: async () => {},
};
