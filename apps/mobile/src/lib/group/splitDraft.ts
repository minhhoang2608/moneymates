import { parseAmount } from "../money";
import { splitByAmount, splitByPercent, splitEqual, type SplitResult } from "../split";

export type DraftMode = "equal" | "amount" | "percent";

export type DraftShare = { memberId: string; amount?: number; bp?: number };

export type DraftStatus =
  | { kind: "ok" }
  | { kind: "short"; diff: number }
  | { kind: "over"; diff: number }
  | { kind: "percentNot100"; diffBp: number; over: boolean }
  | { kind: "noMembers" }
  | { kind: "invalidValue" };

export type SplitDraft = {
  ok: boolean;
  shares: DraftShare[];
  /** Per-member computed amount (only when ok). */
  preview: { memberId: string; amount: number }[];
  status: DraftStatus;
};

export type SplitDraftInput = {
  amount: number | null;
  mode: DraftMode;
  /** Member ids in display order. */
  members: string[];
  ticked: Set<string>;
  amountInputs: Record<string, string>;
  percentInputs: Record<string, string>;
};

/** "33,5" / "33.5" / "50" → basis points (max 2 decimals), else null. No float math. */
export function parsePercentBp(text: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return bp > 10000 ? null : bp;
}

const INVALID: SplitDraft = { ok: false, shares: [], preview: [], status: { kind: "invalidValue" } };

export function evaluateSplitDraft(input: SplitDraftInput): SplitDraft {
  const ids = input.members.filter((id) => input.ticked.has(id));
  if (ids.length === 0) return { ok: false, shares: [], preview: [], status: { kind: "noMembers" } };
  if (input.amount === null || !Number.isSafeInteger(input.amount) || input.amount <= 0) return INVALID;

  let shares: DraftShare[];
  let result: SplitResult;
  if (input.mode === "equal") {
    shares = ids.map((memberId) => ({ memberId }));
    result = splitEqual(input.amount, ids);
  } else if (input.mode === "amount") {
    const parts: { memberId: string; amount: number }[] = [];
    for (const memberId of ids) {
      const text = (input.amountInputs[memberId] ?? "").trim();
      const p = text === "0" ? ({ ok: true, vnd: 0 } as const) : parseAmount(text);
      if (!p.ok) return INVALID;
      parts.push({ memberId, amount: p.vnd });
    }
    shares = parts;
    result = splitByAmount(input.amount, parts);
  } else {
    const parts: { memberId: string; bp: number }[] = [];
    for (const memberId of ids) {
      const bp = parsePercentBp(input.percentInputs[memberId] ?? "");
      if (bp === null) return INVALID;
      parts.push({ memberId, bp });
    }
    shares = parts;
    result = splitByPercent(input.amount, parts);
    if (!result.ok && result.reason === "percentNot100") {
      const sum = parts.reduce((t, x) => t + x.bp, 0);
      return {
        ok: false,
        shares: [],
        preview: [],
        status: { kind: "percentNot100", diffBp: result.diffBp, over: sum > 10000 },
      };
    }
  }

  if (result.ok) return { ok: true, shares, preview: result.shares, status: { kind: "ok" } };
  if (result.reason === "percentNot100") return INVALID;
  return { ok: false, shares: [], preview: [], status: { kind: result.reason, diff: result.diff } };
}
