import type { GroupSettlementSummary } from "../../db/repositories/settlementRepository";
import { formatVnd } from "../money";
import { formatSettlementItem } from "../settlement";

export type SummaryRowView = {
  memberId: string;
  name: string;
  isMe: boolean;
  paid: string;
  owed: string;
  balance: string;
  tone: "positive" | "negative" | "zero";
};

export type SummaryItemView = {
  memberId: string;
  label: string;
  amount: number;
  hasQr: boolean;
};

export type SummaryView = { rows: SummaryRowView[]; items: SummaryItemView[]; toCollect: number };

const MINUS = "−";

/** Signed balance: `+500.000đ`, `−400.000đ`, `0đ`. */
export function formatSigned(n: number): string {
  if (n === 0) return formatVnd(0);
  return `${n > 0 ? "+" : MINUS}${formatVnd(Math.abs(n))}`;
}

export function toSummaryView(
  members: { id: string; displayName: string; isMe: boolean }[],
  summary: GroupSettlementSummary,
  meLabel: string,
): SummaryView {
  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m?.isMe ? meLabel : (m?.displayName ?? "");
  };
  const meId = members.find((m) => m.isMe)?.id;
  const rows = summary.rows.map<SummaryRowView>((r) => ({
    memberId: r.memberId,
    name: nameOf(r.memberId),
    isMe: r.isMe,
    paid: formatVnd(r.paid),
    owed: formatVnd(r.owed),
    balance: formatSigned(r.balance),
    tone: r.balance > 0 ? "positive" : r.balance < 0 ? "negative" : "zero",
  }));
  const items = summary.items.map<SummaryItemView>((it) => {
    const memberId = it.from === meId ? it.to : it.from;
    return { memberId, label: formatSettlementItem(it, nameOf), amount: it.amount, hasQr: it.to === meId };
  });
  const toCollect = summary.items.filter((it) => it.to === meId).reduce((s, it) => s + it.amount, 0);
  return { rows, items, toCollect };
}
