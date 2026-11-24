import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";
import { Platform } from "react-native";

import { writeQrPng } from "@/lib/share/qrImage";

import { openIntentUri, sharePng } from "../../../modules/bank-hand-off";

import type { HandOffDeps } from "./handOff";

export const ALBUM_NAME = "MoneyMates";

/** Saves the PNG into the "MoneyMates" album (created on first use). Skips silently when permission is denied. */
export async function saveToMoneyMatesAlbum(base64: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return; // skip the image step, the app still opens
  const asset = await MediaLibrary.createAssetAsync(writeQrPng(base64));
  const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
  if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  else await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
}

/** Live deps; `getQrBase64` returns the PNG of the current QR from the hidden QRCode. */
export function createNativeDeps(getQrBase64: () => Promise<string | null>): HandOffDeps {
  return {
    platform: Platform.OS === "android" ? "android" : "ios",
    openUrl: async (url) => {
      await Linking.openURL(url);
    },
    openIntent: async (url) => {
      await openIntentUri(url);
    },
    shareToPackage: async (pkg) => {
      const b64 = await getQrBase64();
      if (!b64) throw new Error("no QR image");
      await sharePng(b64, pkg);
    },
    setClipboard: async (text) => {
      await Clipboard.setStringAsync(text);
    },
    saveQrImage: async () => {
      const b64 = await getQrBase64();
      if (b64) await saveToMoneyMatesAlbum(b64);
    },
  };
}
