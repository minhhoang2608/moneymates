import { isE2E } from "@/e2e/isE2E";
import { vi } from "@/i18n/vi";

export type AppLockAuth = {
  /** True when the device has biometrics/passcode set up. */
  isLockAvailable(): Promise<boolean>;
  /** Shows the system prompt; true only on success. Never throws. */
  authenticate(): Promise<boolean>;
};

/** Live adapter on expo-local-authentication. Loaded lazily so Jest and E2E never touch the native module. */
export function createLiveAppLockAuth(): AppLockAuth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LA = require("expo-local-authentication");
  return {
    async isLockAvailable() {
      try {
        return !!(await LA.hasHardwareAsync()) && !!(await LA.isEnrolledAsync());
      } catch {
        return false;
      }
    },
    async authenticate() {
      try {
        const res = await LA.authenticateAsync({
          promptMessage: vi.appLock.prompt,
          cancelLabel: vi.appLock.cancel,
          disableDeviceFallback: false,
        });
        return !!res?.success;
      } catch {
        return false;
      }
    },
  };
}

export function createE2eAppLockAuth(): AppLockAuth {
  return { isLockAvailable: async () => true, authenticate: async () => true };
}

let override: AppLockAuth | null = null;
let cached: AppLockAuth | null = null;

/** Replace the active adapter (null restores the default). Tests use this. */
export function setAppLockAuth(a: AppLockAuth | null): void {
  override = a;
}

export function getAppLockAuth(): AppLockAuth {
  if (override) return override;
  cached ??= isE2E() ? createE2eAppLockAuth() : createLiveAppLockAuth();
  return cached;
}
