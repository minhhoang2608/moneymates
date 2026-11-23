import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";

import { writeQrPng } from "@/lib/share/qrImage";

import type { HandOffDeps } from "./handOff";

export async function saveBase64Png(base64: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return; // skip the image step, the app still opens
  await MediaLibrary.saveToLibraryAsync(writeQrPng(base64));
}

/** Live deps; `getQrBase64` returns the PNG of the current QR from the hidden QRCode. */
export function createNativeDeps(getQrBase64: () => Promise<string | null>): HandOffDeps {
  return {
    openUrl: async (url) => {
      await Linking.openURL(url);
    },
    setClipboard: async (text) => {
      await Clipboard.setStringAsync(text);
    },
    saveQrImage: async () => {
      const b64 = await getQrBase64();
      if (b64) await saveBase64Png(b64);
    },
  };
}
