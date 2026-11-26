import { create } from "zustand";

/** The payment just handed to a bank app, until the user comes back (then its return time is recorded). */
export type Pending = {
  txId: string;
  amount: number;
  label: string;
  handOffId?: string;
};

type State = {
  pending: Pending | null;
  set: (p: Pending) => void;
  setHandOffId: (id: string) => void;
  clear: () => void;
};

export const usePendingHandOff = create<State>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
  setHandOffId: (handOffId) => set((s) => (s.pending ? { pending: { ...s.pending, handOffId } } : s)),
  clear: () => set({ pending: null }),
}));
