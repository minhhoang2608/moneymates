export type TransactionErrorCode =
  "invalid_amount" | "invalid_type" | "invalid_source" | "category_required" | "invalid_occurred_at" | "not_found";

export class TransactionError extends Error {
  readonly code: TransactionErrorCode;

  constructor(code: TransactionErrorCode) {
    super(code);
    this.name = "TransactionError";
    this.code = code;
  }
}
