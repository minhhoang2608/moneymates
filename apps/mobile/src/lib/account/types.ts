export type BankAccountErrorCode = "bank_required" | "account_no_required" | "not_found";

export class BankAccountError extends Error {
  readonly code: BankAccountErrorCode;

  constructor(code: BankAccountErrorCode) {
    super(code);
    this.name = "BankAccountError";
    this.code = code;
  }
}
