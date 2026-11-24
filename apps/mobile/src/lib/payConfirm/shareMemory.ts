import { normalizeAppId } from "./apps";
import type { KnownShareResult } from "./decideHandOff";

/** What we learned per bank/wallet app about sharing the QR image straight to it. Absent = unknown. */
export type ShareMemory = Record<string, KnownShareResult>;

export function recordShareResult(mem: ShareMemory, appId: string, worked: boolean): ShareMemory {
  return { ...mem, [normalizeAppId(appId)]: worked ? "share_ok" : "share_failed" };
}

export function knownResultFor(mem: ShareMemory, appId: string): KnownShareResult | undefined {
  return mem[normalizeAppId(appId)];
}
