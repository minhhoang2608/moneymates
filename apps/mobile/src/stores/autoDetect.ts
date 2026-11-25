import { create } from "zustand";

type State = {
  version: number;
  /** Id of the hand-off most recently marked paid by a notification (no notification content). */
  lastMatchedHandOffId: string | null;
  bump: () => void;
  setMatched: (id: string) => void;
};

/** Bumped whenever the "auto-detect transfers" setting changes so the notification subscriber re-syncs. */
export const useAutoDetect = create<State>((set) => ({
  version: 0,
  lastMatchedHandOffId: null,
  bump: () => set((s) => ({ version: s.version + 1 })),
  setMatched: (id) => set({ lastMatchedHandOffId: id }),
}));
