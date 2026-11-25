import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { e2eFeatures } from "@/e2e/fixtures";
import { isE2E } from "@/e2e/isE2E";

import { apiGet } from "./client";
import type { ApiErrorCode } from "./errors";

export type Features = {
  ai_enabled: boolean;
  ai_parse_text: boolean;
  ai_parse_bill: boolean;
};

/** Used whenever the server can't be reached. Core flows are offline; AI needs the network. */
export const DEFAULT_FEATURES: Features = {
  ai_enabled: false,
  ai_parse_text: false,
  ai_parse_bill: false,
};

/** A cold start (network, TLS, server spin-up) can exceed the default 5 s, so this call gets more time. */
const FEATURES_TIMEOUT_MS = 10_000;
const FEATURES_FRESH_MS = 60 * 1000;
const FEATURES_KEY = ["me", "features", "status"] as const;

export async function fetchFeatures(): Promise<Features> {
  const raw = await apiGet<Partial<Record<keyof Features, unknown>>>("/me/features", {
    timeoutMs: FEATURES_TIMEOUT_MS,
  });
  const pick = (k: keyof Features) => (typeof raw?.[k] === "boolean" ? (raw[k] as boolean) : DEFAULT_FEATURES[k]);
  return {
    ai_enabled: pick("ai_enabled"),
    ai_parse_text: pick("ai_parse_text"),
    ai_parse_bill: pick("ai_parse_bill"),
  };
}

/** `code` is why the check failed (shown to the user so a failure on a phone can be diagnosed). */
type FeaturesStatus = { ok: true; features: Features } | { ok: false; code: ApiErrorCode | "unknown" };

/** Never throws: any failure (no URL, network, timeout, HTTP error, bad JSON) becomes `{ ok: false, code }`. */
function useFeaturesStatus() {
  const e2e = isE2E();
  const { data } = useQuery<FeaturesStatus>({
    queryKey: FEATURES_KEY,
    queryFn: async () => {
      try {
        return { ok: true, features: await fetchFeatures() };
      } catch (e) {
        const code = (e as { code?: ApiErrorCode } | null)?.code;
        return { ok: false, code: code ?? "unknown" };
      }
    },
    enabled: !e2e,
    retry: false,
    // A failed check is cached as data, so it must always count as stale to be refetchable.
    staleTime: (q) => (q.state.data?.ok ? FEATURES_FRESH_MS : 0),
  });
  return e2e ? ({ ok: true, features: e2eFeatures } as FeaturesStatus) : data;
}

/**
 * Returns a callback that re-checks /me/features unless a successful result is still fresh (`force` skips that
 * check, for a user tap on a disabled feature). No-op in E2E.
 */
export function useRefreshFeatures(): (force?: boolean) => void {
  const client = useQueryClient();
  return useCallback(
    (force?: boolean) => {
      if (isE2E()) return;
      const state = client.getQueryState<FeaturesStatus>(FEATURES_KEY);
      const fresh = state?.data?.ok && Date.now() - state.dataUpdatedAt < FEATURES_FRESH_MS;
      if (fresh && !force) return;
      void client.refetchQueries({ queryKey: FEATURES_KEY });
    },
    [client],
  );
}

/** Always yields a Features value; never throws. */
export function useFeatures(): Features {
  const status = useFeaturesStatus();
  return status?.ok ? status.features : DEFAULT_FEATURES;
}

export type AiUnavailableReason = "disabled" | "offline" | "loading";

/** Shared gate for every AI entry point. `available` is only true after a successful /me/features response. */
export function useAiAvailable(feature?: "parse_text" | "parse_bill"): {
  available: boolean;
  reason: AiUnavailableReason | null;
  /** Why the /me/features check failed, when `reason` is "offline". */
  errorCode: ApiErrorCode | "unknown" | null;
} {
  const status = useFeaturesStatus();
  if (!status) return { available: false, reason: "loading", errorCode: null };
  if (!status.ok) return { available: false, reason: "offline", errorCode: status.code };
  const f = status.features;
  const on = f.ai_enabled && (feature ? f[`ai_${feature}`] : true);
  return on
    ? { available: true, reason: null, errorCode: null }
    : { available: false, reason: "disabled", errorCode: null };
}
