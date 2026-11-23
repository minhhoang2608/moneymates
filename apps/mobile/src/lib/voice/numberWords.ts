/** Lowercase, strip diacritics (đ → d) and anything that is not a letter or digit. */
export function normalizeToken(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const DIGITS: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  nham: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
};

const UNITS: Record<string, number> = {
  k: 1_000,
  nghin: 1_000,
  ngan: 1_000,
  cu: 1_000_000,
  trieu: 1_000_000,
  ty: 1_000_000_000,
  ti: 1_000_000_000,
};

export type NumberWordsResult = { vnd: number; consumed: number };

type Group = {
  hundreds: number | null;
  tens: number | null; // 0 after "linh"/"lẻ"
  ones: number | null;
  pending: number | null; // a digit word not yet attached
};

const emptyGroup = (): Group => ({ hundreds: null, tens: null, ones: null, pending: null });

/** Flushes the pending digit and returns the group value, or null when the group is empty or invalid. */
function groupValue(g: Group): number | null {
  const { hundreds, pending } = g;
  let { tens, ones } = g;
  if (pending !== null) {
    if (tens !== null && ones === null) ones = pending;
    else if (hundreds !== null && tens === null)
      tens = pending * 10; // "hai trăm năm" = 250
    else if (hundreds === null && tens === null && ones === null) ones = pending;
    else return null;
  }
  if (hundreds === null && tens === null && ones === null) return null;
  return (hundreds ?? 0) * 100 + (tens ?? 0) + (ones ?? 0);
}

/**
 * Parses a spoken Vietnamese amount ("hai mươi lăm nghìn", "một triệu rưỡi") from the start of `tokens`.
 * The phrase must end in a money unit (nghìn/ngàn/k/triệu/củ/tỷ); a bare "hai trăm" is unsure, so null.
 * Returns the integer VND value and how many tokens were consumed. Diacritics and case are ignored.
 */
export function parseNumberWords(tokens: readonly string[]): NumberWordsResult | null {
  let total = 0;
  let group = emptyGroup();
  let lastUnit = Infinity;
  let lastUnitValue = 0;
  let good: NumberWordsResult | null = null;
  let afterUnit = false;

  const finishGood = (consumed: number) => {
    if (Number.isSafeInteger(total) && total > 0) good = { vnd: total, consumed };
  };

  for (let i = 0; i < tokens.length; i++) {
    const w = normalizeToken(tokens[i]);
    const digit = DIGITS[w];
    const unit = UNITS[w];
    if (digit !== undefined) {
      if (group.pending !== null) break;
      group.pending = digit;
      afterUnit = false;
    } else if (w === "tram") {
      if (group.pending === null || group.hundreds !== null || group.tens !== null || group.ones !== null) break;
      group.hundreds = group.pending;
      group.pending = null;
      afterUnit = false;
    } else if (w === "muoi") {
      if (group.tens !== null || group.ones !== null) break;
      if (group.pending !== null) {
        if (group.pending < 2) break;
        group.tens = group.pending * 10; // mươi
        group.pending = null;
      } else {
        group.tens = 10; // mười
      }
      afterUnit = false;
    } else if (w === "linh" || w === "le") {
      if (group.hundreds === null || group.tens !== null || group.pending !== null) break;
      group.tens = 0;
      afterUnit = false;
    } else if (w === "ruoi") {
      if (afterUnit) {
        total += lastUnitValue / 2;
        afterUnit = false;
        finishGood(i + 1);
        break; // "rưỡi" always closes the phrase
      }
      if (group.hundreds !== null && group.tens === null && group.ones === null && group.pending === null) {
        group.tens = 50; // "hai trăm rưỡi nghìn"
      } else break;
    } else if (unit !== undefined) {
      const v = groupValue(group);
      if (v === null || unit >= lastUnit) break;
      total += v * unit;
      lastUnit = unit;
      lastUnitValue = unit;
      group = emptyGroup();
      afterUnit = true;
      finishGood(i + 1);
    } else {
      break;
    }
  }
  return good;
}
