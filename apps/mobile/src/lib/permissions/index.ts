import { isE2E } from "@/e2e/isE2E";
import { createE2ePermissionAdapter } from "@/e2e/permissions";

import { createExpoPermissionAdapter } from "./expoAdapter";
import type { PermissionAdapter, PermissionKind, PermissionResponse, PermissionState } from "./types";

export type { PermissionAdapter, PermissionKind, PermissionResponse, PermissionState } from "./types";

let override: PermissionAdapter | null = null;
let cached: PermissionAdapter | null = null;

/** Tests inject a fake adapter; null restores the live (or E2E) one. */
export function setPermissionAdapter(adapter: PermissionAdapter | null): void {
  override = adapter;
}

function adapter(): PermissionAdapter {
  if (override) return override;
  cached ??= isE2E() ? createE2ePermissionAdapter() : createExpoPermissionAdapter();
  return cached;
}

export function mapState(resp: PermissionResponse | null | undefined): PermissionState {
  if (!resp) return "denied";
  if (
    resp.granted ||
    resp.status === "granted" ||
    resp.accessPrivileges === "all" ||
    resp.accessPrivileges === "limited"
  )
    return "granted";
  if (resp.status === "undetermined") return "not_asked";
  return "denied";
}

export async function getPermissionState(kind: PermissionKind): Promise<PermissionState> {
  try {
    return mapState(await adapter().get(kind));
  } catch {
    return "denied";
  }
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionState> {
  try {
    return mapState(await adapter().request(kind));
  } catch {
    return "denied";
  }
}

/** Asks only when the system dialog was never shown; a denied permission is never re-requested. */
export async function ensurePermission(kind: PermissionKind): Promise<PermissionState> {
  const state = await getPermissionState(kind);
  if (state !== "not_asked") return state;
  return requestPermission(kind);
}

export async function openAppSettings(): Promise<void> {
  await adapter().openSettings();
}
