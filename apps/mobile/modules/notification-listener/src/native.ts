import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type IncomingNotification = {
  packageName: string;
  title: string;
  text: string;
  /** Epoch milliseconds. */
  postedAt: number;
};

export type NotificationListenerNative = {
  isAccessGranted(): Promise<boolean>;
  openAccessSettings(): Promise<void>;
  setAllowedPackages(packages: string[]): void;
  addListener(event: "onNotification", handler: (e: IncomingNotification) => void): { remove(): void };
};

/** The native module, or null off Android / when it is not linked. */
export function loadNative(): NotificationListenerNative | null {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<NotificationListenerNative>("NotificationListener");
  } catch {
    return null;
  }
}
