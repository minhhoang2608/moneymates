import { DEFAULT_CATEGORIES } from "./defaults";
import type { DefaultCategory } from "./defaults";
import { CATEGORY_KEYWORDS } from "./keywords";

/** Lowercase, strip diacritics (đ → d), turn punctuation into spaces and split into tokens. */
function normalizeForMatch(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

const compiled = CATEGORY_KEYWORDS.flatMap(({ category, keywords }) => {
  const target = DEFAULT_CATEGORIES.find((c) => c.type === "expense" && c.name === category);
  if (!target) return [];
  return keywords.map((k) => ({ category: target, tokens: normalizeForMatch(k) }));
});

/** Returns the earliest position where a keyword matches as whole consecutive tokens, with its category. */
function firstMatch(tokens: string[]): { pos: number; category: DefaultCategory } | null {
  let best: { pos: number; category: DefaultCategory } | null = null;
  for (const { category, tokens: kw } of compiled) {
    if (kw.length === 0) continue;
    for (let i = 0; i + kw.length <= tokens.length; i++) {
      if (best && i >= best.pos) break;
      if (kw.every((t, j) => tokens[i + j] === t)) {
        best = { pos: i, category };
        break;
      }
    }
  }
  return best;
}

/**
 * Suggests an expense category from the recipient name and transfer message using the keyword list.
 * Matching ignores case and diacritics and works on whole words only. When both fields match,
 * the message wins (it says what was bought; a recipient can be generic); inside one field the
 * earliest match wins. Returns null when nothing matches. Pure: no I/O.
 */
export function suggestCategory(
  recipientName: string | null | undefined,
  message: string | null | undefined,
): DefaultCategory | null {
  const fromMessage = firstMatch(normalizeForMatch(message ?? ""));
  if (fromMessage) return fromMessage.category;
  return firstMatch(normalizeForMatch(recipientName ?? ""))?.category ?? null;
}
