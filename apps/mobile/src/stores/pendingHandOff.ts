import { create } from "zustand";

import type { PayApp } from "@/lib/payConfirm/apps";
import type { PayConfirmModel } from "@/lib/payConfirm/params";

/** What "Mở lại <bank>" needs to hand the same payment off again. */
export type Reopen = {
  app: PayApp;
  model: PayConfirmModel;
  amount: number;
  note: string;
  /** A QR image was saved to the album for this hand-off. */
  qrInAlbum: boolean;
};

export type Pending = {
  txId: string;
  amount: number;
  label: string;
  handOffId?: string;
  reopen?: Reopen;
};

type State = {
  pending: Pending | null;
  visible: boolean;
  deletedVersion: number;
  set: (p: Pending) => void;
  setHandOffId: (id: string) => void;
  setReopen: (r: Reopen) => void;
  reveal: () => void;
  /** Hides the banner but keeps the pending hand-off, so it shows again on the next return. */
  hide: () => void;
  clear: () => void;
  markDeleted: () => void;
};

export const usePendingHandOff = create<State>((set) => ({
  pending: null,
  visible: false,
  deletedVersion: 0,
  set: (pending) => set({ pending, visible: false }),
  setHandOffId: (handOffId) => set((s) => (s.pending ? { pending: { ...s.pending, handOffId } } : s)),
  setReopen: (reopen) => set((s) => (s.pending ? { pending: { ...s.pending, reopen } } : s)),
  reveal: () => set((s) => (s.pending ? { visible: true } : s)),
  hide: () => set({ visible: false }),
  clear: () => set({ pending: null, visible: false }),
  markDeleted: () => set((s) => ({ pending: null, visible: false, deletedVersion: s.deletedVersion + 1 })),
}));
