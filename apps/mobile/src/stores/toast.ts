import { create } from "zustand";

export type ToastAction = { label: string; onPress: () => void };

type State = {
  text: string | null;
  action: ToastAction | null;
  show: (text: string, action?: ToastAction) => void;
  hide: () => void;
};

export const useToast = create<State>((set) => ({
  text: null,
  action: null,
  show: (text, action) => set({ text, action: action ?? null }),
  hide: () => set({ text: null, action: null }),
}));
