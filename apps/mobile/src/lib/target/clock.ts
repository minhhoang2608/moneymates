import type { TargetGroup } from "./types";

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of `now` in Vietnam local time (fixed UTC+7, same as lib/stats). */
export function vnToday(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** A group is ended once its end date is before today (VN). The end date itself is still active. */
export function isGroupEnded(group: Pick<TargetGroup, "end_date">, now: Date): boolean {
  return group.end_date != null && group.end_date < vnToday(now);
}
