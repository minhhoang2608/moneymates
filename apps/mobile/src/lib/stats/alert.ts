export type AlertLevel = "none" | "up" | "down";

/** Alert when spending differs from last month by more than 20% (strictly). No alert if last month is 0. */
export function alertLevel(thisMonth: number, lastMonth: number): AlertLevel {
  if (!Number.isSafeInteger(thisMonth) || !Number.isSafeInteger(lastMonth)) {
    throw new Error("Amounts must be integer VND");
  }
  if (lastMonth <= 0) return "none";
  const diff = thisMonth - lastMonth;
  if (5 * Math.abs(diff) <= lastMonth) return "none";
  return diff > 0 ? "up" : "down";
}
