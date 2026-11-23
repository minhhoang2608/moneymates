import { isGroupEnded } from "./clock";
import type { LastUsed, Target, TargetGroup } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toGroupTarget(g: TargetGroup, now: Date): Target {
  return { kind: "group", groupId: g.id, name: g.name, icon: g.icon, ended: isGroupEnded(g, now) };
}

export type ResolveInput = {
  lastUsed: LastUsed;
  groups: TargetGroup[];
  now: Date;
  /** Opened from a group's detail screen: always wins while the group exists. */
  fromGroupId?: string;
};

/** Default "Ghi vào" target: the group opened from, else the last-used group within 24h and not ended, else Cá nhân. */
export function resolveDefaultTarget({ lastUsed, groups, now, fromGroupId }: ResolveInput): Target {
  if (fromGroupId) {
    const from = groups.find((g) => g.id === fromGroupId);
    if (from) return toGroupTarget(from, now);
  }
  if (lastUsed && lastUsed.target !== "personal") {
    const { groupId } = lastUsed.target;
    const group = groups.find((g) => g.id === groupId);
    const at = Date.parse(lastUsed.at);
    if (group && !isGroupEnded(group, now) && !Number.isNaN(at) && now.getTime() - at <= DAY_MS) {
      return toGroupTarget(group, now);
    }
  }
  return { kind: "personal" };
}
