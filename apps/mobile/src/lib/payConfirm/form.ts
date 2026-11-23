import type { NewGroupExpense } from "../../db/repositories/groupExpenseRepository";
import type { NewTransaction } from "../../db/repositories/transactionRepository";
import { parseAmount } from "../money";
import type { PayConfirmModel } from "./params";

/** True when the amount text parses to an integer > 0. */
export function canSubmit(amountText: string): boolean {
  return parseAmount(amountText).ok;
}

export function buildQrExpense(
  model: PayConfirmModel,
  input: { amount: number; categoryId: string; note: string },
  now: Date,
): NewTransaction {
  return {
    type: "expense",
    amount: input.amount,
    category_id: input.categoryId,
    note: input.note.trim(),
    occurred_at: now.toISOString(),
    source: "qr",
    qr_data: model.payload || null,
  };
}

/** QR payment into a group: "Tôi" paid, split equally between all members. */
export function buildQrGroupExpense(
  model: PayConfirmModel,
  input: { amount: number; categoryId: string; note: string },
  groupId: string,
  members: { id: string; isMe: boolean }[],
  now: Date,
): NewGroupExpense {
  const payer = members.find((m) => m.isMe) ?? members[0];
  return {
    groupId,
    amount: input.amount,
    payerMemberId: payer.id,
    splitMode: "equal",
    shares: members.map((m) => ({ memberId: m.id })),
    occurredAt: now.toISOString(),
    categoryId: input.categoryId,
    note: input.note.trim(),
    source: "qr",
    qrData: model.payload || null,
  };
}
