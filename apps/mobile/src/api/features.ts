import { useQuery } from "@tanstack/react-query";

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

/** Always yields a Features value; never throws. */
export function useFeatures(): Features {
  const { data } = useQuery({
    queryKey: ["me", "features"],
    queryFn: async () => {
      try {
        return await fetchFeatures();
      } catch {
        return DEFAULT_FEATURES;
      }
    },
    placeholderData: DEFAULT_FEATURES,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? DEFAULT_FEATURES;
}
