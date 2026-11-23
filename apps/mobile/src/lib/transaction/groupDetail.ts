import { vi } from "@/i18n/vi";

export type GroupSplitView = {
  groupName: string;
  payerName: string;
  modeLabel: string;
  count: number;
  rows: { memberId: string; name: string; amount: number }[];
};

type MemberLike = { id: string; displayName: string; isMe: boolean };

/** Pure view model for the payer and shares of a group expense (integer VND, no float math). */
export function buildGroupSplitView(
  txn: { split_mode: string | null; paid_by_member_id: string | null },
  group: { name: string; members: MemberLike[] },
  shares: { member_id: string; amount: number }[],
): GroupSplitView {
  const nameOf = (id: string | null): string => {
    const m = group.members.find((x) => x.id === id);
    if (!m) return "?";
    return m.isMe ? vi.detail.me : m.displayName;
  };
  const mode = (txn.split_mode ?? "equal") as keyof typeof vi.detail.splitModes;
  return {
    groupName: group.name,
    payerName: nameOf(txn.paid_by_member_id),
    modeLabel: vi.detail.splitModes[mode] ?? vi.detail.splitModes.equal,
    count: shares.length,
    rows: shares.map((s) => ({ memberId: s.member_id, name: nameOf(s.member_id), amount: Number(s.amount) })),
  };
}
