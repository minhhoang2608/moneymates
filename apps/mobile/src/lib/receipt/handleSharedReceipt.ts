import { EMPTY_RECEIPT } from "./rules";
import { applyReceipt, type ReceiptDeps, type ReceiptDraft, type UndoHandle } from "./apply";
import { parseReceipt, type ParsedReceipt } from "./parseReceipt";

export type SharedReceiptDeps = {
  receipt: ReceiptDeps;
  recognize: (uri: string) => Promise<string[]>;
  deleteQrImages: (handOffIds: string[]) => Promise<unknown>;
};

export type SharedReceiptOutcome =
  | { kind: "matched"; recipient: string; undo: UndoHandle }
  | { kind: "new"; draft: ReceiptDraft; parsed: ParsedReceipt };

/**
 * A shared receipt image end to end, fully offline and without navigation:
 * read text → parse → match a pending payment or draft a new transaction.
 * An unreadable image yields a draft with empty fields.
 */
export async function handleSharedReceipt(
  deps: SharedReceiptDeps,
  uri: string,
  now: Date = new Date(),
): Promise<SharedReceiptOutcome> {
  let lines: string[] = [];
  try {
    lines = await deps.recognize(uri);
  } catch {
    lines = [];
  }
  const parsed = lines.length > 0 ? parseReceipt(lines) : { ...EMPTY_RECEIPT };
  const result = await applyReceipt(deps.receipt, { uri, parsed, now });
  if (result.kind === "matched") {
    try {
      await deps.deleteQrImages([result.handOffId]);
    } catch (e) {
      console.warn("could not delete QR image", e);
    }
    return { kind: "matched", recipient: parsed.recipient ?? "", undo: result.undo };
  }
  return { kind: "new", draft: result.draft, parsed };
}
