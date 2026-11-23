const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "YYYY-MM" of an ISO UTC timestamp in Vietnam local time (fixed UTC+7, no DST). */
export function monthKeyOf(isoUtc: string): string {
  const t = Date.parse(isoUtc);
  if (Number.isNaN(t)) throw new Error(`Invalid date: ${isoUtc}`);
  const d = new Date(t + VN_OFFSET_MS);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
}
