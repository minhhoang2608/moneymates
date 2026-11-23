export type Share = { memberId: string; amount: number };

export type SplitResult =
  | { ok: true; shares: Share[] }
  | { ok: false; reason: "short" | "over"; diff: number }
  | { ok: false; reason: "percentNot100"; diffBp: number };

const TOTAL_BP = 10000;

function assertNonNegInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer, got ${String(value)}`);
  }
}

function assertMembers(ids: string[]): void {
  if (ids.length === 0) throw new Error("members must not be empty");
  if (new Set(ids).size !== ids.length) throw new Error("duplicate member ids");
}

/** Equal split; the remainder (1đ each) goes to the first members in input order. */
export function splitEqual(amount: number, memberIds: string[]): SplitResult {
  assertNonNegInt(amount, "amount");
  assertMembers(memberIds);
  const n = memberIds.length;
  const base = Math.floor(amount / n);
  const rem = amount - base * n;
  return {
    ok: true,
    shares: memberIds.map((memberId, i) => ({ memberId, amount: base + (i < rem ? 1 : 0) })),
  };
}

/** Split by explicit amounts; the sum must equal the total. */
export function splitByAmount(amount: number, parts: Share[]): SplitResult {
  assertNonNegInt(amount, "amount");
  assertMembers(parts.map((p) => p.memberId));
  let sum = 0;
  for (const p of parts) {
    assertNonNegInt(p.amount, "part amount");
    sum += p.amount;
  }
  if (!Number.isSafeInteger(sum)) throw new Error("sum of parts is not a safe integer");
  if (sum < amount) return { ok: false, reason: "short", diff: amount - sum };
  if (sum > amount) return { ok: false, reason: "over", diff: sum - amount };
  return { ok: true, shares: parts.map((p) => ({ memberId: p.memberId, amount: p.amount })) };
}

/**
 * Split by basis points (10000 = 100%). Shares are floored, then leftover đồng go
 * one at a time to the largest fractional remainders (ties: input order).
 */
export function splitByPercent(amount: number, percents: { memberId: string; bp: number }[]): SplitResult {
  assertNonNegInt(amount, "amount");
  assertMembers(percents.map((p) => p.memberId));
  let sumBp = 0;
  for (const p of percents) {
    assertNonNegInt(p.bp, "bp");
    sumBp += p.bp;
  }
  if (sumBp !== TOTAL_BP) {
    return { ok: false, reason: "percentNot100", diffBp: Math.abs(TOTAL_BP - sumBp) };
  }
  const q = Math.floor(amount / TOTAL_BP);
  const r = amount % TOTAL_BP;
  const rows = percents.map((p, index) => {
    const low = r * p.bp; // < 1e8, exact
    return {
      memberId: p.memberId,
      index,
      amount: q * p.bp + Math.floor(low / TOTAL_BP),
      frac: low % TOTAL_BP,
    };
  });
  let leftover = amount - rows.reduce((s, x) => s + x.amount, 0);
  const order = [...rows].sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const row of order) {
    if (leftover <= 0) break;
    row.amount += 1;
    leftover -= 1;
  }
  return { ok: true, shares: rows.map(({ memberId, amount: a }) => ({ memberId, amount: a })) };
}
