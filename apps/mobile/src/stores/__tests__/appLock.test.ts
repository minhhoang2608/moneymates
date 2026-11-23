import { useAppLock } from "../appLock";

beforeEach(() => useAppLock.setState({ status: "loading", prompting: false, enabled: false }));

describe("appLock store", () => {
  it("init unlocked when disabled, locked when enabled", () => {
    useAppLock.getState().init(false);
    expect(useAppLock.getState().status).toBe("unlocked");
    useAppLock.getState().init(true);
    expect(useAppLock.getState().status).toBe("locked");
  });

  it("lock is a no-op when disabled", () => {
    useAppLock.getState().init(false);
    useAppLock.getState().lock();
    expect(useAppLock.getState().status).toBe("unlocked");
  });

  it("unlockAttempt unlocks on success, stays locked on failure or throw", async () => {
    useAppLock.getState().init(true);
    await useAppLock.getState().unlockAttempt(async () => false);
    expect(useAppLock.getState()).toMatchObject({ status: "locked", prompting: false });
    await useAppLock.getState().unlockAttempt(async () => {
      throw new Error("x");
    });
    expect(useAppLock.getState().status).toBe("locked");
    await useAppLock.getState().unlockAttempt(async () => true);
    expect(useAppLock.getState().status).toBe("unlocked");
  });

  it("does not prompt twice while prompting", async () => {
    useAppLock.getState().init(true);
    let resolve!: (v: boolean) => void;
    const auth = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const first = useAppLock.getState().unlockAttempt(auth);
    await useAppLock.getState().unlockAttempt(auth);
    expect(auth).toHaveBeenCalledTimes(1);
    resolve(true);
    await first;
    expect(useAppLock.getState().status).toBe("unlocked");
  });

  it("setEnabled(true) does not lock; setEnabled(false) unlocks", () => {
    useAppLock.getState().init(false);
    useAppLock.getState().setEnabled(true);
    expect(useAppLock.getState().status).toBe("unlocked");
    useAppLock.getState().lock();
    useAppLock.getState().setEnabled(false);
    expect(useAppLock.getState().status).toBe("unlocked");
  });
});
