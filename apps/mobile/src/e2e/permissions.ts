import type { PermissionAdapter } from "@/lib/permissions/types";

/** E2E mode: every permission is already granted and no system dialog appears. */
export function createE2ePermissionAdapter(): PermissionAdapter {
  const granted = async () => ({ status: "granted" as const, granted: true, canAskAgain: true });
  return { get: granted, request: granted, openSettings: async () => {} };
}
