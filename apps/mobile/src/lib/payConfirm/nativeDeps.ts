import * as Clipboard from "expo-clipboard";
import { Directory, File, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";

import type { HandOffDeps } from "./handOff";

export async function saveBase64Png(base64: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return; // skip the image step, the app still opens
  const dir = new Directory(Paths.cache, "handoff");
  dir.create({ idempotent: true });
  const file = new File(dir, `qr-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: "base64" });
  await MediaLibrary.saveToLibraryAsync(file.uri);
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
