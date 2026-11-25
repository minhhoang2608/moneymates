import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";

/** The three lines copied in "no image" mode: STK, amount, note. Empty parts are dropped. */
export function buildPasteText(input: { account?: string; amount: number; note: string }): string {
  if (!Number.isSafeInteger(input.amount)) throw new RangeError(`amount must be an integer VND, got ${input.amount}`);
  const l = vi.payConfirm.pasteText;
  const lines: string[] = [];
  if (input.account) lines.push(`${l.account}: ${input.account}`);
  lines.push(`${l.amount}: ${formatVnd(input.amount)}`);
  const note = input.note.trim();
  if (note) lines.push(`${l.note}: ${note}`);
  return lines.join("\n");
}
