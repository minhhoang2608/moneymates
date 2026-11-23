export type ParseAmountResult = { ok: true; vnd: number } | { ok: false };

const FAIL: ParseAmountResult = { ok: false };

// unit value, and the value of one trailing-digit step ("1tr2" -> 2 * 100_000).
const UNITS: Record<string, { value: number; sub: number }> = {
  k: { value: 1_000, sub: 1 },
  nghìn: { value: 1_000, sub: 1 },
  nghin: { value: 1_000, sub: 1 },
  ngàn: { value: 1_000, sub: 1 },
  ngan: { value: 1_000, sub: 1 },
  tr: { value: 1_000_000, sub: 1_000 },
  triệu: { value: 1_000_000, sub: 1_000 },
  trieu: { value: 1_000_000, sub: 1_000 },
  củ: { value: 1_000_000, sub: 1_000 },
  cu: { value: 1_000_000, sub: 1_000 },
  tỷ: { value: 1_000_000_000, sub: 1_000_000 },
  ty: { value: 1_000_000_000, sub: 1_000_000 },
  tỉ: { value: 1_000_000_000, sub: 1_000_000 },
  ti: { value: 1_000_000_000, sub: 1_000_000 },
};

const PATTERN = /^(\d+)(?:([.,])(\d+))?\s*(\p{L}+)?(\d+)?$/u;
const GROUPED = /^\d{1,3}([.,]\d{3})+$/;

function finish(vnd: number): ParseAmountResult {
  if (!Number.isSafeInteger(vnd) || vnd <= 0) return FAIL;
  return { ok: true, vnd };
}

/** Parses Vietnamese shorthand ("50k", "1tr2", "1.5tr", "50.000") into integer VND. */
export function parseAmount(text: string): ParseAmountResult {
  const s = text.normalize("NFC").toLowerCase().trim();
  if (!s) return FAIL;

  // Thousands-grouped number without a unit ("1.250.000", "50,000").
  if (GROUPED.test(s)) {
    if (new Set(s.replace(/\d/g, "")).size !== 1) return FAIL;
    return finish(parseInt(s.replace(/[.,]/g, ""), 10));
  }

  const m = PATTERN.exec(s);
  if (!m) return FAIL;
  const [, intPart, , fracPart, unitName, trailing] = m;

  if (unitName === undefined) {
    if (trailing !== undefined) return FAIL;
    // A lone separator part that isn't thousands-grouped ("50.00") is invalid.
    if (fracPart !== undefined) return FAIL;
    return finish(parseInt(intPart, 10));
  }

  const unit = UNITS[unitName];
  if (!unit) return FAIL;
  if (fracPart !== undefined && trailing !== undefined) return FAIL;

  const base = parseInt(intPart, 10) * unit.value;
  if (fracPart !== undefined) {
    const scaled = parseInt(fracPart, 10) * unit.value;
    const div = 10 ** fracPart.length;
    if (scaled % div !== 0) return FAIL;
    return finish(base + scaled / div);
  }
  if (trailing !== undefined) {
    if (trailing.length > 3) return FAIL;
    const frac = parseInt(trailing.padEnd(3, "0"), 10);
    return finish(base + frac * unit.sub);
  }
  return finish(base);
}
