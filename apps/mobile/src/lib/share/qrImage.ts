import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";

/** Writes a base64 PNG to the cache and returns its uri. */
export function writeQrPng(base64: string): string {
  const dir = new Directory(Paths.cache, "handoff");
  dir.create({ idempotent: true });
  const file = new File(dir, `qr-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: "base64" });
  return file.uri;
}

/**
 * Re-encodes the QR PNG as a full-quality JPEG. Bank apps register for image/jpeg (what the Gallery shares
 * for photos and screenshots) more often than for image/png.
 */
export async function toQrJpeg(base64Png: string): Promise<{ uri: string; base64: string }> {
  const res = await ImageManipulator.manipulateAsync(writeQrPng(base64Png), [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return { uri: res.uri, base64: res.base64 ?? "" };
}

export async function saveQrToGallery(base64: string): Promise<"saved" | "denied"> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return "denied";
  await MediaLibrary.saveToLibraryAsync(writeQrPng(base64));
  return "saved";
}

export async function shareQr(base64: string): Promise<"shared" | "unavailable"> {
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(writeQrPng(base64), { mimeType: "image/png" });
  return "shared";
}
