import { useQuery } from "@tanstack/react-query";

import { e2eFeatures } from "@/e2e/fixtures";
import { isE2E } from "@/e2e/isE2E";

import { apiGet } from "./client";

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

export async function fetchFeatures(): Promise<Features> {
  const raw = await apiGet<Partial<Record<keyof Features, unknown>>>("/me/features");
  const pick = (k: keyof Features) => (typeof raw?.[k] === "boolean" ? (raw[k] as boolean) : DEFAULT_FEATURES[k]);
  return {
    ai_enabled: pick("ai_enabled"),
    ai_parse_text: pick("ai_parse_text"),
    ai_parse_bill: pick("ai_parse_bill"),
  };
}

type FeaturesStatus = { ok: true; features: Features } | { ok: false };

/** Never throws: any failure (no URL, network, timeout, HTTP error, bad JSON) becomes `{ ok: false }`. */
function useFeaturesStatus() {
  const e2e = isE2E();
  const { data } = useQuery<FeaturesStatus>({
    queryKey: ["me", "features", "status"],
    queryFn: async () => {
      try {
        return { ok: true, features: await fetchFeatures() };
      } catch {
        return { ok: false };
      }
    },
    enabled: !e2e,
    retry: false,
    staleTime: 60 * 1000,
  });
  return e2e ? ({ ok: true, features: e2eFeatures } as FeaturesStatus) : data;
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
} {
  const status = useFeaturesStatus();
  if (!status) return { available: false, reason: "loading" };
  if (!status.ok) return { available: false, reason: "offline" };
  const f = status.features;
  const on = f.ai_enabled && (feature ? f[`ai_${feature}`] : true);
  return on ? { available: true, reason: null } : { available: false, reason: "disabled" };
}
