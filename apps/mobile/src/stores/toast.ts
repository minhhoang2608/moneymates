import { create } from "zustand";

type State = { text: string | null; show: (text: string) => void; hide: () => void };

export const useToast = create<State>((set) => ({
  text: null,
  show: (text) => set({ text }),
  hide: () => set({ text: null }),
}));
