import { create } from "zustand";

export type AppLockStatus = "loading" | "unlocked" | "locked";

type State = {
  status: AppLockStatus;
  prompting: boolean;
  enabled: boolean;
  init: (enabled: boolean) => void;
  lock: () => void;
  /** Runs one auth prompt; a no-op while another one is showing. */
  unlockAttempt: (authenticate: () => Promise<boolean>) => Promise<void>;
  setEnabled: (on: boolean) => void;
};

export const useAppLock = create<State>((set, get) => ({
  status: "loading",
  prompting: false,
  enabled: false,
  init: (enabled) => set({ enabled, status: enabled ? "locked" : "unlocked" }),
  lock: () => set((s) => (s.enabled ? { status: "locked" } : s)),
  unlockAttempt: async (authenticate) => {
    if (get().prompting) return;
    set({ prompting: true });
    let ok = false;
    try {
      ok = await authenticate();
    } catch {
      ok = false;
    }
    set(ok ? { prompting: false, status: "unlocked" } : { prompting: false });
  },
  // Enabling does not lock immediately; disabling unlocks.
  setEnabled: (on) => set((s) => ({ enabled: on, status: on ? s.status : "unlocked" })),
}));
