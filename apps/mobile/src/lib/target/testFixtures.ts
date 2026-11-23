import type { TargetGroup } from "./types";

export const NOW = new Date("2026-12-10T05:00:00Z");
export const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

export const grp = (id: string, name: string, extra: Partial<TargetGroup> = {}): TargetGroup => ({
  id,
  name,
  icon: "🏖️",
  end_date: null,
  created_at: "2026-07-01T00:00:00Z",
  ...extra,
});
