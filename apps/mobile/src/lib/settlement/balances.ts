export type SettleMember = { id: string; name: string; isMe?: boolean };
export type GroupExpense = { paidBy: string; amount: number; shares: Record<string, number> };
export type SettlementPayment = { from: string; to: string; amount: number; paidAt?: string | null };
export type MemberBalance = { memberId: string; paid: number; owed: number; balance: number };

function assertAmount(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${what} must be a safe integer, got ${n}`);
}

/**
 * balance = paid - owed + settledOut - settledIn (integer VND).
 * Positive: the group owes this member. Negative: this member owes the group.
 * Only payments with `paidAt` set count.
 */
export function computeBalances(input: {
  members: SettleMember[];
  expenses: GroupExpense[];
  payments?: SettlementPayment[];
}): MemberBalance[] {
  const { members, expenses, payments = [] } = input;
  const rows = new Map<string, MemberBalance>();
  for (const m of members) rows.set(m.id, { memberId: m.id, paid: 0, owed: 0, balance: 0 });
  const row = (id: string): MemberBalance => {
    const r = rows.get(id);
    if (!r) throw new RangeError(`Unknown member id: ${id}`);
    return r;
  };
  const settled = new Map<string, number>();
  const bump = (id: string, delta: number) => settled.set(id, (settled.get(id) ?? 0) + delta);

  for (const e of expenses) {
    assertAmount(e.amount, "expense amount");
    row(e.paidBy).paid += e.amount;
    for (const [id, share] of Object.entries(e.shares)) {
      assertAmount(share, "share");
      row(id).owed += share;
    }
  }
  for (const p of payments) {
    assertAmount(p.amount, "payment amount");
    row(p.from);
    row(p.to);
    if (!p.paidAt) continue;
    bump(p.from, p.amount);
    bump(p.to, -p.amount);
  }
  const result = members.map((m) => {
    const r = row(m.id);
    return { ...r, balance: r.paid - r.owed + (settled.get(m.id) ?? 0) };
  });
  if (result.reduce((s, r) => s + r.balance, 0) !== 0) {
    throw new RangeError("Balances do not sum to 0: shares must add up to the expense amounts");
  }
  return result;
}
