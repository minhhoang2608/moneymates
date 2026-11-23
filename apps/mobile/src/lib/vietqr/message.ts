export const MAX_MESSAGE_LENGTH = 25;

/** Strip diacritics, keep only ASCII letters/digits, everything else becomes a single space. */
export function toAsciiText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
}

/** Transfer message "<Nhóm> <Tên>", ASCII, at most 25 chars. Group is truncated first. */
export function buildTransferMessage(groupName?: string, memberName?: string): string | null {
  const group = toAsciiText(groupName ?? "");
  let member = toAsciiText(memberName ?? "");
  if (!group && !member) return null;
  if (!group) return member.slice(0, MAX_MESSAGE_LENGTH).trim();
  if (!member) return group.slice(0, MAX_MESSAGE_LENGTH).trim();
  if (member.length > MAX_MESSAGE_LENGTH - 2) {
    member = member.slice(0, MAX_MESSAGE_LENGTH - 2).trim();
  }
  const room = MAX_MESSAGE_LENGTH - 1 - member.length;
  const g = group.slice(0, room).trim();
  return g ? `${g} ${member}` : member;
}
