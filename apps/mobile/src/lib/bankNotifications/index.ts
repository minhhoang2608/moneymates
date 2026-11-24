import { mbbankRule } from "./rules/mbbank";
import { momoRule } from "./rules/momo";
import { techcombankRule } from "./rules/techcombank";
import { tpbankRule } from "./rules/tpbank";
import { vietcombankRule } from "./rules/vietcombank";
import { zalopayRule } from "./rules/zalopay";
import type { BankNotification, BankRule } from "./types";

export type { BankNotification, BankRule } from "./types";
export { parseSignedVnd } from "./amount";

const RULES: BankRule[] = [tpbankRule, techcombankRule, mbbankRule, vietcombankRule, momoRule, zalopayRule];

const BY_PACKAGE = new Map<string, BankRule>(RULES.flatMap((r) => r.packageNames.map((p) => [p, r] as const)));

export function parseBankNotification(packageName: string, title: string, text: string): BankNotification | null {
  const rule = BY_PACKAGE.get(packageName);
  if (!rule || !text || !text.trim()) return null;
  return rule.parse(title ?? "", text);
}
