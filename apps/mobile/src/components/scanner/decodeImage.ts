import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

export type PickResult = { cancelled: true } | { cancelled: false; text: string | null };

/** Let the user pick an image and decode the first QR in it. */
export async function pickAndDecodeQr(): Promise<PickResult> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled || !res.assets?.[0]?.uri) return { cancelled: true };
  try {
    const found = await scanFromURLAsync(res.assets[0].uri, ["qr"]);
    return { cancelled: false, text: found[0]?.data ?? null };
  } catch {
    return { cancelled: false, text: null };
  }
}
