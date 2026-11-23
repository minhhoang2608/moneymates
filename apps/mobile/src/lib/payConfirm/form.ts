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
