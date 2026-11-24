import { create } from "zustand";

export type Pending = {
  txId: string;
  amount: number;
  label: string;
  qrHint?: boolean;
  appId?: string;
  askPaid?: boolean;
};

type State = {
  pending: Pending | null;
  visible: boolean;
  deletedVersion: number;
  set: (p: Pending) => void;
  showQrHint: () => void;
  askPaid: (appId: string) => void;
  answerPaid: () => void;
  reveal: () => void;
  clear: () => void;
  markDeleted: () => void;
};

export const usePendingHandOff = create<State>((set) => ({
  pending: null,
  visible: false,
  deletedVersion: 0,
  set: (pending) => set({ pending, visible: false }),
  showQrHint: () => set((s) => (s.pending ? { pending: { ...s.pending, qrHint: true } } : s)),
  askPaid: (appId) => set((s) => (s.pending ? { pending: { ...s.pending, appId, askPaid: true } } : s)),
  answerPaid: () => set((s) => (s.pending ? { pending: { ...s.pending, askPaid: false } } : s)),
  reveal: () => set((s) => (s.pending ? { visible: true } : s)),
  clear: () => set({ pending: null, visible: false }),
  markDeleted: () => set((s) => ({ pending: null, visible: false, deletedVersion: s.deletedVersion + 1 })),
}));
