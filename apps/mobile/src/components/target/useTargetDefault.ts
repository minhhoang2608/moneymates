import { useEffect, useRef, useState } from "react";

import { useRepositories } from "@/db/RepositoriesProvider";
import type { GroupSummary } from "@/db/repositories";
import { resolveDefaultTarget, systemClock } from "@/lib/target";
import type { Clock, Target } from "@/lib/target";

/** Loads groups + last-used data once and resolves the default "Ghi vào" target; a manual choice is never overwritten. */
export function useTargetDefault(opts: { fromGroupId?: string; clock?: Clock; enabled?: boolean } = {}) {
  const { fromGroupId, clock = systemClock, enabled = true } = opts;
  const { groups: groupRepo, transactions } = useRepositories();
  const [loaded, setLoaded] = useState(!enabled);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [lastUsedByGroup, setLastUsedByGroup] = useState<Map<string, string>>(new Map());
  const [target, setTargetState] = useState<Target>({ kind: "personal" });
  const [now, setNow] = useState(() => clock());
  const chosen = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([groupRepo.listGroups(), transactions.lastUsedTarget(), transactions.lastRecordedAtByGroup()]).then(
      ([gs, lastUsed, byGroup]) => {
        if (!alive) return;
        const at = clock();
        setNow(at);
        setGroups(gs);
        setLastUsedByGroup(byGroup);
        if (!chosen.current) setTargetState(resolveDefaultTarget({ lastUsed, groups: gs, now: at, fromGroupId }));
        setLoaded(true);
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupRepo, transactions, enabled, fromGroupId]);

  const setTarget = (t: Target) => {
    chosen.current = true;
    setTargetState(t);
  };
  const memberCounts = new Map(groups.map((g) => [g.id, g.members.length]));
  return { loaded, groups, lastUsedByGroup, memberCounts, now, target, setTarget };
}
