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

export type PermissionInfo = { state: PermissionState; canAskAgain: boolean };

function toInfo(resp: PermissionResponse | null | undefined): PermissionInfo {
  return { state: mapState(resp), canAskAgain: resp?.canAskAgain !== false };
}

/** State plus whether the system dialog can still be shown (Android denies once, then may ask again). */
export async function getPermissionInfo(kind: PermissionKind): Promise<PermissionInfo> {
  try {
    return toInfo(await adapter().get(kind));
  } catch {
    return { state: "denied", canAskAgain: false };
  }
}

export async function requestPermissionInfo(kind: PermissionKind): Promise<PermissionInfo> {
  try {
    return toInfo(await adapter().request(kind));
  } catch {
    return { state: "denied", canAskAgain: false };
  }
}

export async function getPermissionState(kind: PermissionKind): Promise<PermissionState> {
  return (await getPermissionInfo(kind)).state;
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionState> {
  return (await requestPermissionInfo(kind)).state;
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
