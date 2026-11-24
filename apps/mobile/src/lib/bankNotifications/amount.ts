export type SignedVnd = { sign: "+" | "-" | null; vnd: number };

const GROUPED = /^\d{1,3}([.,]\d{3})+$/;
const PLAIN = /^\d+$/;

/**
 * Parses an amount token such as `-55,000`, `+1.250.000`, `55.000đ` or `55,000 VND`
 * into a sign and an integer VND value. Returns null for decimals, mixed separators
 * or anything that is not a whole number of VND.
 */
export function parseSignedVnd(raw: string): SignedVnd | null {
  const m = raw
    .normalize("NFC")
    .trim()
    .match(/^([+\-−])?\s*([\d.,]+)\s*(?:VND|VNĐ|đ|₫)?$/iu);
  if (!m) return null;
  const digits = m[2];
  if (!PLAIN.test(digits) && !GROUPED.test(digits)) return null;
  // GROUPED matches only one separator family when consistent; reject mixed.
  if (digits.includes(".") && digits.includes(",")) return null;
  const vnd = parseInt(digits.replace(/[.,]/g, ""), 10);
  if (!Number.isSafeInteger(vnd)) return null;
  const sign = m[1] === "+" ? "+" : m[1] ? "-" : null;
  return { sign, vnd };
}
