export type AccountFormErrors = { bank_required?: true; account_no_required?: true };

export function validateAccountForm(input: { bank_bin: string | null; account_no: string }): AccountFormErrors {
  const errors: AccountFormErrors = {};
  if (!input.bank_bin) errors.bank_required = true;
  if (!input.account_no.replace(/\s+/g, "")) errors.account_no_required = true;
  return errors;
}
