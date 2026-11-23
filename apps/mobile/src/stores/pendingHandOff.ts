import { create } from "zustand";

export type Pending = { txId: string; amount: number; label: string };

type State = {
  pending: Pending | null;
  visible: boolean;
  deletedVersion: number;
  set: (p: Pending) => void;
  reveal: () => void;
  clear: () => void;
  markDeleted: () => void;
};

export const usePendingHandOff = create<State>((set) => ({
  pending: null,
  visible: false,
  deletedVersion: 0,
  set: (pending) => set({ pending, visible: false }),
  reveal: () => set((s) => (s.pending ? { visible: true } : s)),
  clear: () => set({ pending: null, visible: false }),
  markDeleted: () => set((s) => ({ pending: null, visible: false, deletedVersion: s.deletedVersion + 1 })),
}));
