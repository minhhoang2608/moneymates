import { toAsciiText } from "@/lib/vietqr/message";

export type AccountFormErrors = { bank_required?: true; account_no_required?: true };

export function validateAccountForm(input: { bank_bin: string | null; account_no: string }): AccountFormErrors {
  const errors: AccountFormErrors = {};
  if (!input.bank_bin) errors.bank_required = true;
  if (!input.account_no.replace(/\s+/g, "")) errors.account_no_required = true;
  return errors;
}

/** Holder name as printed on bank apps: ASCII, upper case, single spaces. */
export function normalizeHolderName(s: string): string {
  return toAsciiText(s).toUpperCase();
}

/** True when the account number is non-empty and made of digits only (spaces ignored). */
export function isAccountNoNumeric(s: string): boolean {
  return /^\d+$/.test(s.replace(/\s+/g, ""));
}
