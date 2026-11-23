import { formatVnd } from "../money";
import type { MemberBalance, SettleMember } from "./balances";

export type SettlementItem = { from: string; to: string; amount: number };

/** "Tôi thu hộ": everyone pays or receives only from the "me" member. Member order is kept. */
export function settlementList(members: SettleMember[], balances: MemberBalance[]): SettlementItem[] {
  const me = members.find((m) => m.isMe);
  if (!me) throw new RangeError("No member is marked isMe");
  const byId = new Map(balances.map((b) => [b.memberId, b.balance]));
  const items: SettlementItem[] = [];
  for (const m of members) {
    if (m.id === me.id) continue;
    const b = byId.get(m.id) ?? 0;
    if (b < 0) items.push({ from: m.id, to: me.id, amount: -b });
    else if (b > 0) items.push({ from: me.id, to: m.id, amount: b });
  }
  return items;
}

export function formatSettlementItem(item: SettlementItem, nameOf: (id: string) => string): string {
  const from = nameOf(item.from);
  const to = nameOf(item.to);
  const verb = "trả";
  return `${from} ${verb} ${to} ${formatVnd(item.amount)}`;
}
