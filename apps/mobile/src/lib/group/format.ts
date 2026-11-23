import { vi } from "@/i18n/vi";

import type { GroupErrorCode } from "./types";

/** "2026-12-01","2026-12-04" -> "01–04/12"; different months -> "28/11–03/12"; open ended -> text. */
export function formatGroupDates(start: string | null, end: string | null): string {
  if (!start && !end) return vi.groups.noDates;
  const parse = (d: string) => {
    const [, m, day] = d.split("-");
    return { m, day };
  };
  if (start && end) {
    const a = parse(start);
    const b = parse(end);
    return a.m === b.m && start.slice(0, 4) === end.slice(0, 4)
      ? `${a.day}–${b.day}/${a.m}`
      : `${a.day}/${a.m}–${b.day}/${b.m}`;
  }
  const only = parse((start ?? end) as string);
  return start ? `${vi.groups.from} ${only.day}/${only.m}` : `${vi.groups.until} ${only.day}/${only.m}`;
}

export function memberLabel(m: { displayName: string; isMe: boolean }): string {
  return m.isMe ? `${m.displayName || vi.groups.me} (${vi.groups.me})` : m.displayName;
}

export function groupErrorMessage(code: GroupErrorCode): string {
  return vi.groups.errors[code] ?? vi.groups.errors.unknown;
}

/** Local Date -> `YYYY-MM-DD`. */
export function toDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `YYYY-MM-DD` -> local Date at noon (avoids timezone day shifts). */
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** `YYYY-MM-DD` -> "dd/MM/yyyy". */
export function displayDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
