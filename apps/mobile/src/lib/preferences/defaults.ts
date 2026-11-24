export type MoneySourceKind = "cash" | "bank" | "wallet" | "card";

export const MONEY_SOURCE_KINDS: MoneySourceKind[] = ["cash", "bank", "wallet", "card"];

/** Same ids and names as the rows seeded by migration `0007_preferences.sql`. */
export const DEFAULT_MONEY_SOURCES: { id: string; name: string; kind: MoneySourceKind }[] = [
  { id: "5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d01", name: "Tiền mặt", kind: "cash" },
  { id: "5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d02", name: "Ngân hàng", kind: "bank" },
  { id: "5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d03", name: "Ví điện tử", kind: "wallet" },
  { id: "5b1f0c1e-7a41-4d0e-9a52-0c6a1e2b3d04", name: "Thẻ", kind: "card" },
];

export const DEFAULT_CURRENCY = "VND";

export const PREF_KEYS = {
  alertOverLastMonth: "alert_over_last_month",
  defaultCurrency: "default_currency",
  appLockEnabled: "app_lock_enabled",
  directShareMemory: "direct_share_memory",
  defaultBankSuggestionDismissed: "default_bank_suggestion_dismissed",
  recentPayApps: "pay.recent_apps",
} as const;

export class PreferencesError extends Error {
  constructor(public code: "name_required" | "invalid_kind" | "not_found" | "invalid_currency") {
    super(code);
  }
}
