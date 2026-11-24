import { isE2E } from "../../src/e2e/isE2E";
import { e2eIsAccessGranted, e2eOpenAccessSettings, e2eSubscribe } from "../../src/e2e/notificationListener";
import { loadNative, type IncomingNotification } from "./src/native";

export type { IncomingNotification } from "./src/native";

type Handler = (e: IncomingNotification) => void;
type Sub = { handler: Handler; packages: string[] };

const subs = new Set<Sub>();
let nativeSub: { remove(): void } | null = null;

function sync(): void {
  const native = loadNative();
  if (!native) return;
  if (subs.size === 0) {
    nativeSub?.remove();
    nativeSub = null;
    native.setAllowedPackages([]);
    return;
  }
  native.setAllowedPackages([...new Set([...subs].flatMap((s) => s.packages))]);
  if (!nativeSub) {
    nativeSub = native.addListener("onNotification", (e) => {
      for (const s of [...subs]) if (s.packages.includes(e.packageName)) s.handler(e);
    });
  }
}

/** Whether the user granted "Truy cập thông báo" to this app. False off Android. */
export async function isAccessGranted(): Promise<boolean> {
  if (isE2E()) return e2eIsAccessGranted();
  const native = loadNative();
  return native ? native.isAccessGranted() : false;
}

/** Opens the system notification-access settings. No-op off Android. */
export async function openAccessSettings(): Promise<void> {
  if (isE2E()) return e2eOpenAccessSettings();
  const native = loadNative();
  if (native) await native.openAccessSettings();
}

/** Delivers notifications from `allowedPackages` only. Returns an unsubscribe function. */
export function subscribe(handler: Handler, allowedPackages: string[]): () => void {
  if (isE2E()) return e2eSubscribe(handler, allowedPackages);
  if (!loadNative()) return () => {};
  const sub: Sub = { handler, packages: [...allowedPackages] };
  subs.add(sub);
  sync();
  return () => {
    if (subs.delete(sub)) sync();
  };
}
