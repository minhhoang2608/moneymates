import { vi } from "../../i18n/vi";
import { isGroupEnded } from "./clock";
import { normalizeSearch } from "./normalize";
import type { Target, TargetGroup } from "./types";

export type ListTargetsInput = {
  groups: TargetGroup[];
  /** group id → ISO UTC `created_at` of its newest live transaction. */
  lastUsedByGroup: Map<string, string>;
  now: Date;
  query?: string;
};

const ms = (s: string | undefined): number => {
  const t = s === undefined ? NaN : Date.parse(s);
  return Number.isNaN(t) ? -Infinity : t;
};

/** Cá nhân, then active groups by last use, then ended groups. A query filters every row. */
export function listTargets({ groups, lastUsedByGroup, now, query = "" }: ListTargetsInput): Target[] {
  const used = (g: TargetGroup) => ms(lastUsedByGroup.get(g.id));
  const byRecent = (a: TargetGroup, b: TargetGroup) =>
    used(b) - used(a) || ms(b.created_at) - ms(a.created_at) || (b.end_date ?? "").localeCompare(a.end_date ?? "");
  const byRecentEnded = (a: TargetGroup, b: TargetGroup) =>
    used(b) - used(a) || (b.end_date ?? "").localeCompare(a.end_date ?? "") || ms(b.created_at) - ms(a.created_at);

  const active = groups.filter((g) => !isGroupEnded(g, now)).sort(byRecent);
  const ended = groups.filter((g) => isGroupEnded(g, now)).sort(byRecentEnded);
  const all: Target[] = [
    { kind: "personal" },
    ...active.map((g): Target => ({ kind: "group", groupId: g.id, name: g.name, icon: g.icon, ended: false })),
    ...ended.map((g): Target => ({ kind: "group", groupId: g.id, name: g.name, icon: g.icon, ended: true })),
  ];
  const q = normalizeSearch(query);
  if (!q) return all;
  return all.filter((t) => normalizeSearch(t.kind === "personal" ? vi.target.personal : t.name).includes(q));
}
