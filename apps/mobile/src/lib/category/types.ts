export type CategoryKind = "expense" | "income";

export type CategoryErrorCode = "name_required" | "not_found" | "default_rename_forbidden" | "default_delete_forbidden";

export class CategoryError extends Error {
  readonly code: CategoryErrorCode;

  constructor(code: CategoryErrorCode) {
    super(code);
    this.name = "CategoryError";
    this.code = code;
  }
}
