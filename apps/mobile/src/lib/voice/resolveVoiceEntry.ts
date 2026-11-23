import type { ApiErrorCode } from "../../api/errors";
import { parseSpokenExpense, type SpokenCategory, type SpokenMember } from "./parseSpokenExpense";

export type AiParseResult = {
  amount: number | null;
  note: string | null;
  category: string | null;
  payer: string | null;
};

export type VoiceEntry = {
  amount: number | null;
  note: string;
  categoryId: string | null;
  payerMemberId: string | null;
  aiError?: ApiErrorCode;
};

export type ResolveVoiceOptions = {
  categories: readonly SpokenCategory[];
  members?: readonly SpokenMember[];
  aiAvailable: boolean;
  parseTextFn: (text: string, categories: string[], members?: string[]) => Promise<AiParseResult>;
};

const OTHER = "Khác";

/** Offline rules first; the AI only fills what they were unsure about. Never throws. */
export async function resolveVoiceEntry(text: string, opts: ResolveVoiceOptions): Promise<VoiceEntry> {
  const { categories, members, aiAvailable, parseTextFn } = opts;
  const off = parseSpokenExpense(text, { categories, members });
  const other = categories.find((c) => c.name === OTHER)?.id ?? null;
  const out: VoiceEntry = {
    amount: off.amount,
    note: off.note,
    categoryId: off.category?.id ?? null,
    payerMemberId: off.payer.matched ? off.payer.memberId : null,
  };
  if (off.needsAi && aiAvailable) {
    try {
      const ai = await parseTextFn(
        text,
        categories.map((c) => c.name),
        members?.map((m) => m.name),
      );
      if (out.amount === null && Number.isInteger(ai?.amount) && (ai.amount as number) > 0) out.amount = ai.amount;
      const note = typeof ai?.note === "string" ? ai.note.trim() : "";
      if (note) out.note = note;
      if (out.categoryId === null) out.categoryId = categories.find((c) => c.name === ai?.category)?.id ?? null;
      if (out.payerMemberId === null && members) {
        out.payerMemberId = members.find((m) => m.name === ai?.payer)?.id ?? null;
      }
    } catch (e) {
      const code = (e as { code?: ApiErrorCode })?.code;
      out.aiError = code ?? "network";
      out.categoryId = null;
    }
  }
  out.categoryId ??= other;
  return out;
}
