import type { HandOffDeps } from "@/lib/payConfirm/handOff";

export const openedUrls: string[] = [];

/** E2E mode: record the URL and stay in the app. */
export const e2eHandOffDeps: HandOffDeps = {
  platform: "android",
  openIntent: async (url) => {
    openedUrls.push(url);
    throw new Error("e2e: bank app not opened");
  },
  shareToPackage: async (pkg) => {
    openedUrls.push(`share:${pkg}`);
    throw new Error("e2e: share not supported");
  },
  openUrl: async (url) => {
    openedUrls.push(url);
    throw new Error("e2e: bank app not opened");
  },
  setClipboard: async () => {},
  saveQrImage: async () => ({ assetId: "e2e-qr-asset", access: "read-write" }),
};
