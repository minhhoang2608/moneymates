import { useCallback, useEffect, useRef, useState } from "react";

import { getPermissionInfo, requestPermission, type PermissionInfo, type PermissionKind } from "@/lib/permissions";

export const ONBOARDING_PERMISSIONS: PermissionKind[] = ["camera", "photos", "microphone"];

export type PermissionRows = Partial<Record<PermissionKind, PermissionInfo>>;

/** Reads each permission's status on mount (never requests) and asks one at a time on demand. */
export function usePermissionRows(kinds: PermissionKind[] = ONBOARDING_PERMISSIONS) {
  const [rows, setRows] = useState<PermissionRows>({});
  const pending = useRef(new Set<PermissionKind>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    kinds.forEach((kind) => {
      void getPermissionInfo(kind).then((info) => {
        if (mounted.current) setRows((r) => ({ ...r, [kind]: r[kind] ?? info }));
      });
    });
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = useCallback(async (kind: PermissionKind) => {
    if (pending.current.has(kind)) return;
    pending.current.add(kind);
    try {
      const state = await requestPermission(kind);
      if (mounted.current) setRows((r) => ({ ...r, [kind]: { state, canAskAgain: state !== "denied" } }));
    } finally {
      pending.current.delete(kind);
    }
  }, []);

  return { rows, ask };
}
