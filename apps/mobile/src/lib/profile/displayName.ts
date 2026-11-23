export type DisplayNameResult = { ok: true; name: string } | { ok: false; error: "empty" };

export function validateDisplayName(raw: string): DisplayNameResult {
  const name = raw.trim();
  return name ? { ok: true, name } : { ok: false, error: "empty" };
}

/** Up to two initials for the avatar fallback ("Hoàng Lê" → "HL"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters
    .map((w) => Array.from(w)[0])
    .join("")
    .toLocaleUpperCase("vi-VN");
}
