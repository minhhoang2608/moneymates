import { create } from "zustand";

import type { ReceiptDraft } from "@/lib/receipt/apply";
import type { ParsedReceipt } from "@/lib/receipt/parseReceipt";

export type ReceiptSheetState = { draft: ReceiptDraft; parsed: ParsedReceipt };

type State = {
  current: ReceiptSheetState | null;
  open: (s: ReceiptSheetState) => void;
  close: () => void;
};

export const useReceiptSheet = create<State>((set) => ({
  current: null,
  open: (current) => set({ current }),
  close: () => set({ current: null }),
}));
