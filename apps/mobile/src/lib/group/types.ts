export type GroupErrorCode =
  | "name_required"
  | "invalid_dates"
  | "not_found"
  | "member_not_found"
  | "member_name_required"
  | "cannot_remove_me"
  | "cannot_rename_me"
  | "member_has_transactions"
  | "invalid_account";

export class GroupError extends Error {
  readonly code: GroupErrorCode;

  constructor(code: GroupErrorCode) {
    super(code);
    this.name = "GroupError";
    this.code = code;
  }
}
