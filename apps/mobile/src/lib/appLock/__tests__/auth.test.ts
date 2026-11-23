import * as LA from "expo-local-authentication";

import { createE2eAppLockAuth, createLiveAppLockAuth } from "../auth";

const m = LA as unknown as Record<"hasHardwareAsync" | "isEnrolledAsync" | "authenticateAsync", jest.Mock>;

beforeEach(() => {
  m.hasHardwareAsync.mockReset().mockResolvedValue(true);
  m.isEnrolledAsync.mockReset().mockResolvedValue(true);
  m.authenticateAsync.mockReset().mockResolvedValue({ success: true });
});

describe("app lock auth", () => {
  it("available only with hardware and enrollment", async () => {
    const auth = createLiveAppLockAuth();
    expect(await auth.isLockAvailable()).toBe(true);
    m.isEnrolledAsync.mockResolvedValue(false);
    expect(await auth.isLockAvailable()).toBe(false);
    m.isEnrolledAsync.mockResolvedValue(true);
    m.hasHardwareAsync.mockResolvedValue(false);
    expect(await auth.isLockAvailable()).toBe(false);
  });

  it("allows device passcode fallback and maps success", async () => {
    expect(await createLiveAppLockAuth().authenticate()).toBe(true);
    expect(m.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: false }));
  });

  it("maps failure and thrown errors to false", async () => {
    const auth = createLiveAppLockAuth();
    m.authenticateAsync.mockResolvedValue({ success: false });
    expect(await auth.authenticate()).toBe(false);
    m.authenticateAsync.mockRejectedValue(new Error("boom"));
    expect(await auth.authenticate()).toBe(false);
  });

  it("E2E adapter resolves true without native calls", async () => {
    const auth = createE2eAppLockAuth();
    expect(await auth.authenticate()).toBe(true);
    expect(await auth.isLockAvailable()).toBe(true);
    expect(m.authenticateAsync).not.toHaveBeenCalled();
  });
});
