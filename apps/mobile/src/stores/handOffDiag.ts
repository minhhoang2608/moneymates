import { create } from "zustand";

/** Temporary (#480): what the last direct share did, shown as a toast when the user comes back to the app. */
type State = { text: string | null; set: (text: string | null) => void; take: () => string | null };

export const useHandOffDiag = create<State>((set, get) => ({
  text: null,
  set: (text) => set({ text }),
  take: () => {
    const t = get().text;
    set({ text: null });
    return t;
  },
}));
