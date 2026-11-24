import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type BankHandOffNative = {
  openIntentUri(uri: string): Promise<void>;
  sharePng(base64: string, pkg: string): Promise<void>;
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

/** Sends a base64 PNG to one Android package (ACTION_SEND). Rejects when it can't accept it or off Android. */
export async function sharePng(base64: string, pkg: string): Promise<void> {
  const native = load();
  if (!native) throw new Error("unsupported");
  await native.sharePng(base64, pkg);
}
