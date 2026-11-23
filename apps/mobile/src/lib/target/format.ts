import { vi } from "../../i18n/vi";
import type { Target } from "./types";

/** "x phút/giờ/ngày/tuần trước" for an ISO UTC timestamp, relative to `now`. */
export function formatLastUsed(at: string, now: Date): string {
  const diffMin = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / 60_000));
  const t = vi.target;
  let n: number;
  let unit: string;
  if (diffMin < 60) {
    n = Math.max(1, diffMin);
    unit = t.minute;
  } else if (diffMin < 24 * 60) {
    n = Math.floor(diffMin / 60);
    unit = t.hour;
  } else if (diffMin < 7 * 24 * 60) {
    n = Math.floor(diffMin / (24 * 60));
    unit = t.day;
  } else {
    n = Math.floor(diffMin / (7 * 24 * 60));
    unit = t.week;
  }
  return `${n} ${unit} ${t.ago}`;
}

/** `YYYY-MM-DD` → "Kết thúc dd/MM". */
export function formatEndedOn(endDate: string): string {
  const [, m, d] = endDate.split("-");
  return `${vi.target.endedOn} ${d}/${m}`;
}

export function targetName(t: Target): string {
  return t.kind === "personal" ? vi.target.personal : t.name;
}
