import type { CategoryRow } from "@/db/repositories";
import type { ReceiptCandidate } from "@/db/repositories/handOffRepository";
import { OTHER_NAME, pickInitialCategory } from "@/lib/payConfirm/category";

import { MATCH_WINDOW_MS, matchReceipt, toPendingHandOff } from "./match";
import type { ParsedReceipt } from "./rules";

export type ReceiptDeps = {
  handOffs: {
    listReceiptCandidates: (since: Date) => Promise<ReceiptCandidate[]>;
    markPaid: (id: string, signal: "receipt") => Promise<boolean>;
    attachReceipt: (id: string, uri: string) => Promise<unknown>;
    detachReceipt: (id: string) => Promise<unknown>;
    clearPaidSignal: (id: string, signal: "receipt") => Promise<void>;
  };
  transactions: {
    create: (input: {
      type: "expense";
      amount: number;
      category_id: string;
      note: string;
      occurred_at: string;
      source: "receipt";
      attachment_uri: string;
    }) => Promise<unknown>;
  };
  categories: { listByKind: (kind: "expense") => Promise<CategoryRow[]> };
};

export type ReceiptDraft = {
  source: "receipt";
  uri: string;
  amount: number | null;
  recipient: string;
  note: string;
  categoryId: string | null;
  occurredAt: string;
};

export type UndoHandle = { handOffId: string; paidByUs: boolean };

export type ApplyResult =
  { kind: "matched"; handOffId: string; undo: UndoHandle } | { kind: "new"; draft: ReceiptDraft };

export async function applyReceipt(
  deps: ReceiptDeps,
  input: { uri: string; parsed: ParsedReceipt; now: Date },
): Promise<ApplyResult> {
  const { uri, parsed, now } = input;
  if (parsed.amount !== null) {
    const rows = await deps.handOffs.listReceiptCandidates(new Date(now.getTime() - MATCH_WINDOW_MS));
    const hit = matchReceipt(parsed, rows.map(toPendingHandOff), now);
    if (hit) {
      const paidByUs = await deps.handOffs.markPaid(hit.handOffId, "receipt");
      await deps.handOffs.attachReceipt(hit.handOffId, uri);
      return { kind: "matched", handOffId: hit.handOffId, undo: { handOffId: hit.handOffId, paidByUs } };
    }
  }
  const categories = await deps.categories.listByKind("expense");
  const occurredAt = parsed.paidAt ?? now.toISOString();
  if (parsed.amount === null) {
    const other = categories.find((c) => c.name === OTHER_NAME)?.id ?? categories[0]?.id ?? null;
    return {
      kind: "new",
      draft: { source: "receipt", uri, amount: null, recipient: "", note: "", categoryId: other, occurredAt },
    };
  }
  const recipient = parsed.recipient ?? "";
  return {
    kind: "new",
    draft: {
      source: "receipt",
      uri,
      amount: parsed.amount,
      recipient,
      note: parsed.message ?? recipient,
      categoryId: pickInitialCategory(categories, parsed.recipient, parsed.message).id,
      occurredAt,
    },
  };
}

export async function undoReceipt(deps: ReceiptDeps, handle: UndoHandle): Promise<void> {
  await deps.handOffs.detachReceipt(handle.handOffId);
  if (handle.paidByUs) await deps.handOffs.clearPaidSignal(handle.handOffId, "receipt");
}

export async function saveReceiptTransaction(deps: ReceiptDeps, draft: ReceiptDraft): Promise<unknown> {
  if (draft.amount === null || !Number.isInteger(draft.amount) || draft.amount <= 0 || !draft.categoryId) {
    throw new Error("invalid_amount");
  }
  return deps.transactions.create({
    type: "expense",
    amount: draft.amount,
    category_id: draft.categoryId,
    note: draft.note,
    occurred_at: draft.occurredAt,
    source: "receipt",
    attachment_uri: draft.uri,
  });
}
