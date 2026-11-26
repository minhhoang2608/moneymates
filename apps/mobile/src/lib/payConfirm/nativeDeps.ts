import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";
import { Platform } from "react-native";

import { writeQrPng } from "@/lib/share/qrImage";

import { openIntentUri, shareMediaImage, sharePng } from "../../../modules/bank-hand-off";

import type { HandOffDeps, SavedQr } from "./handOff";

export const ALBUM_NAME = "MoneyMates";

/**
 * Saves the PNG into the "MoneyMates" album (created on first use) and returns the asset id with the access level.
 * iOS falls back to add-only access when read/write is denied. Returns null when permission is denied.
 */
export async function saveToMoneyMatesAlbum(base64: string): Promise<SavedQr | null> {
  let access: SavedQr["access"] = "read-write";
  if (Platform.OS === "ios") {
    const rw = await MediaLibrary.requestPermissionsAsync(false);
    if (rw.granted) {
      if (rw.accessPrivileges === "limited") access = "limited";
    } else {
      const writeOnly = await MediaLibrary.getPermissionsAsync(true);
      if (!writeOnly.granted) return null; // skip the image step, the app still opens
      access = "add-only";
    }
  } else {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return null;
  }
  const asset = await MediaLibrary.createAssetAsync(writeQrPng(base64));
  const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
  if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  else await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
  return { assetId: asset.id, access };
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
    shareToPackage: async (pkg, albumAssetId) => {
      if (albumAssetId) {
        try {
          return await shareMediaImage(albumAssetId, pkg);
        } catch (e) {
          console.warn("sharing the album QR failed, sending a private copy", e);
        }
      }
      const b64 = await getQrBase64();
      if (!b64) throw new Error("no QR image");
      await sharePng(b64, pkg);
    },
    setClipboard: async (text) => {
      await Clipboard.setStringAsync(text);
    },
    saveQrImage: async () => {
      const b64 = await getQrBase64();
      return b64 ? saveToMoneyMatesAlbum(b64) : null;
    },
  };
}
