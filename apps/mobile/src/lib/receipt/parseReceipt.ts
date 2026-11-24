import { EMPTY_RECEIPT, genericRule, normaliseLines, RECEIPT_RULES } from "./rules";
import type { ParsedReceipt } from "./rules";

export type { ParsedReceipt } from "./rules";

/**
 * Parses recognised receipt text lines. The first bank rule whose `detect` matches wins;
 * fields it could not find are filled by the generic rule. Never throws: unreadable input
 * yields all-null fields.
 */
export function parseReceipt(lines: string[]): ParsedReceipt {
  try {
    const clean = normaliseLines(lines);
    if (clean.length === 0) return { ...EMPTY_RECEIPT };
    const rule = RECEIPT_RULES.find((r) => r.detect(clean));
    const primary = rule ? rule.parse(clean) : {};
    const fallback = genericRule.parse(clean);
    return { ...EMPTY_RECEIPT, ...fallback, ...primary };
  } catch {
    return { ...EMPTY_RECEIPT };
  }
}
