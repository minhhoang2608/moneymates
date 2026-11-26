import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type BankHandOffNative = {
  openIntentUri(uri: string): Promise<void>;
  sharePng(base64: string, pkg: string, mime: string): Promise<void>;
  shareMediaImage(mediaId: string, pkg: string): Promise<void>;
};

function load(): BankHandOffNative | null {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<BankHandOffNative>("BankHandOff");
  } catch {
    return null;
  }
}

/** Opens an `intent://` URI. Rejects when no app resolves it (not installed) or off Android. */
export async function openIntentUri(uri: string): Promise<void> {
  const native = load();
  if (!native) throw new Error("unsupported");
  await native.openIntentUri(uri);
}

/** Sends a base64 image (PNG or JPEG) to one Android package (ACTION_SEND). Rejects when it can't accept it or off Android. */
export async function sharePng(
  base64: string,
  pkg: string,
  mime: "image/png" | "image/jpeg" = "image/png",
): Promise<void> {
  const native = load();
  if (!native) throw new Error("unsupported");
  await native.sharePng(base64, pkg, mime);
}

/** Sends a photo already in the gallery (MediaStore id) to one Android package, as the Gallery app shares it. */
export async function shareMediaImage(mediaId: string, pkg: string): Promise<void> {
  const native = load();
  if (!native) throw new Error("unsupported");
  await native.shareMediaImage(mediaId, pkg);
}
