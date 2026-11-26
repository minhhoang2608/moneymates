import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";
import { Platform } from "react-native";

import { toQrJpeg } from "@/lib/share/qrImage";

import { openIntentUri, shareMediaImage, sharePng } from "../../../modules/bank-hand-off";

import type { HandOffDeps, SavedQr } from "./handOff";

export const ALBUM_NAME = "MoneyMates";

/**
 * Saves the QR (as JPEG) into the "MoneyMates" album (created on first use) and returns the asset id with the access level.
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
  const uri = (await toQrJpeg(base64)).uri;
  const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
  if (album) {
    // Created straight in the album, so this id is the photo that stays there (and is deleted on return).
    const asset = await MediaLibrary.createAssetAsync(uri, album);
    return { assetId: asset.id, access };
  }
  // First use: an album needs a photo to exist. On Android 11+ "moving" a photo into an album copies it and
  // deletes the original, so the id from createAssetAsync is gone; look the photo up in the new album instead.
  const first = await MediaLibrary.createAssetAsync(uri);
  const created = await MediaLibrary.createAlbumAsync(ALBUM_NAME, first, false);
  const page = await MediaLibrary.getAssetsAsync({
    album: created,
    first: 20,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
  });
  const moved = page.assets.find((a) => a.filename === first.filename) ?? page.assets[0];
  return { assetId: moved?.id ?? first.id, access };
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
      let albumError = "";
      if (albumAssetId) {
        try {
          return await shareMediaImage(albumAssetId, pkg);
        } catch (e) {
          console.warn("sharing the album QR failed, sending a private copy", e);
          albumError = `album lỗi (${e instanceof Error ? e.message : String(e)}), `;
        }
      }
      const b64 = await getQrBase64();
      if (!b64) throw new Error("no QR image");
      return `${albumError}file tạm: ${await sharePng((await toQrJpeg(b64)).base64, pkg, "image/jpeg")}`;
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
