import { suggestCategory } from "../category";
import { parseAmount } from "../money";
import { normalizeToken, parseNumberWords } from "./numberWords";

export type SpokenMember = { id: string; name: string; isMe: boolean };
export type SpokenCategory = { id: string; name: string; type: string };
export type SpokenParseOptions = { members?: readonly SpokenMember[]; categories: readonly SpokenCategory[] };

export type ParsedSpokenExpense = {
  amount: number | null;
  currency: "VND";
  note: string;
  category: { id: string; name: string } | null;
  payer: { memberId: string | null; name: string; matched: boolean };
  /** True when the rules were unsure and the caller should ask the AI (or the user). */
  needsAi: boolean;
};

const PAY_VERBS = new Set(["tra", "chi", "bao"]);
const LEADING_VERBS = new Set(["an", "uong", "mua", "do"]);
const SELF_WORDS = new Set(["toi", "minh"]);
const MAX_NAME_TOKENS = 4;

type Phrase = { start: number; len: number; vnd: number };

const strip = (t: string) => t.replace(/[.,;!?]+$/, "");

/** Bare digits are only an amount from 1 000 up ("2 người" is not money). */
function digitAmount(tokens: string[], i: number): { vnd: number; len: number } | null {
  const first = strip(tokens[i]);
  if (!/^\d/.test(first)) return null;
  if (i + 1 < tokens.length) {
    const r = parseAmount(`${first} ${strip(tokens[i + 1])}`);
    if (r.ok) return { vnd: r.vnd, len: 2 };
  }
  const r = parseAmount(first);
  if (!r.ok) return null;
  if (/^\d+$/.test(first) && r.vnd < 1000) return null;
  return { vnd: r.vnd, len: 1 };
}

function findAmounts(tokens: string[], shadow: string[]): Phrase[] {
  const found: Phrase[] = [];
  for (let i = 0; i < tokens.length;) {
    const d = digitAmount(tokens, i);
    if (d) {
      found.push({ start: i, len: d.len, vnd: d.vnd });
      i += d.len;
      continue;
    }
    const w = parseNumberWords(shadow.slice(i));
    if (w) {
      found.push({ start: i, len: w.consumed, vnd: w.vnd });
      i += w.consumed;
      continue;
    }
    i++;
  }
  return found;
}

type PayerResult = { payer: ParsedSpokenExpense["payer"]; clauseLen: number; ambiguous: boolean };

function findPayer(shadow: string[], members: readonly SpokenMember[] | undefined): PayerResult {
  const me = members?.find((m) => m.isMe);
  const self = { memberId: me?.id ?? null, name: me?.name ?? "Tôi", matched: false };
  if (!members) return { payer: self, clauseLen: 0, ambiguous: false };

  let verbAt = -1;
  for (let j = 1; j <= MAX_NAME_TOKENS && j < shadow.length; j++) {
    if (PAY_VERBS.has(shadow[j])) {
      verbAt = j;
      break;
    }
  }
  if (verbAt < 0) return { payer: self, clauseLen: 0, ambiguous: false };

  const name = shadow.slice(0, verbAt);
  const clauseLen = verbAt + 1;
  if (name.length === 1 && SELF_WORDS.has(name[0])) return { payer: self, clauseLen, ambiguous: false };

  const hitsFor = (phrase: string[]) =>
    members.filter((m) => {
      if (m.isMe) return false;
      const parts = m.name.split(/\s+/).map(normalizeToken).filter(Boolean);
      for (let s = 0; s + phrase.length <= parts.length; s++) {
        if (phrase.every((t, k) => parts[s + k] === t)) return true;
      }
      return false;
    });
  // Speech often puts an honorific or a mis-heard word before the name: try the trailing sub-phrases, longest first.
  let hits = hitsFor(name);
  for (let from = 1; hits.length === 0 && from < name.length; from++) hits = hitsFor(name.slice(from));
  if (hits.length === 1) {
    return { payer: { memberId: hits[0].id, name: hits[0].name, matched: true }, clauseLen, ambiguous: false };
  }
  return { payer: self, clauseLen, ambiguous: hits.length > 1 };
}

/**
 * Parses a spoken (speech-to-text) expense sentence with offline rules only: amount, payer, note and
 * category. Conservative: when the amount, category or payer is unclear it sets `needsAi`. Pure, no I/O.
 */
export function parseSpokenExpense(text: string, options: SpokenParseOptions): ParsedSpokenExpense {
  const tokens = text.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const shadow = tokens.map(normalizeToken);

  const amounts = findAmounts(tokens, shadow);
  const amount = amounts.length === 1 ? amounts[0].vnd : null;

  const { payer, clauseLen, ambiguous } = findPayer(shadow, options.members);

  const drop = new Set<number>();
  for (let i = 0; i < clauseLen; i++) drop.add(i);
  for (const a of amounts) for (let i = 0; i < a.len; i++) drop.add(a.start + i);
  let rest = tokens.filter((_, i) => !drop.has(i));
  if (rest.length > 0 && LEADING_VERBS.has(normalizeToken(rest[0]))) rest = rest.slice(1);
  let note = rest.join(" ").trim();
  if (clauseLen > 0 && note) note = note.charAt(0).toLocaleUpperCase("vi") + note.slice(1);

  const suggested = note ? suggestCategory(null, note) : null;
  const row = suggested ? options.categories.find((c) => c.type === "expense" && c.name === suggested.name) : undefined;
  const category = row ? { id: row.id, name: row.name } : null;

  return {
    amount,
    currency: "VND",
    note,
    category,
    payer,
    needsAi: amount === null || category === null || ambiguous,
  };
}
