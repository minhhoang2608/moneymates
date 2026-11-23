export type GroupErrorCode =
  | "name_required"
  | "invalid_dates"
  | "not_found"
  | "member_not_found"
  | "member_name_required"
  | "cannot_remove_me"
  | "cannot_rename_me"
  | "member_has_transactions"
  | "invalid_account"
  | "invalid_split"
  | "invalid_payer"
  | "invalid_share_member"
  | "invalid_amount"
  | "not_group_expense";

export class GroupError extends Error {
  readonly code: GroupErrorCode;
  /** For `invalid_split`: why the split failed and by how much (đồng, or basis points for percent). */
  readonly reason?: string;
  readonly diff?: number;

  constructor(code: GroupErrorCode, detail?: { reason?: string; diff?: number }) {
    super(code);
    this.reason = detail?.reason;
    this.diff = detail?.diff;
    this.name = "GroupError";
    this.code = code;
  }
}
