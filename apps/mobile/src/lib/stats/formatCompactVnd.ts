import { formatVnd } from "@/lib/money";

import { formatMillions } from "./formatMillions";

/** Display only: "3,2tr", "0,95tr". Below 10.000đ (would round to "0tr") falls back to the full amount. */
export function formatCompactVnd(vnd: number): string {
  if (vnd < 10_000) return formatVnd(vnd);
  return `${formatMillions(vnd)}tr`;
}
