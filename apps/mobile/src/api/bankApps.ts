import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Platform } from "react-native";

import { isE2E } from "@/e2e/isE2E";
import { buildPayApps, type PayApp } from "@/lib/payConfirm/apps";
import { SNAPSHOT, parseBankAppsResponse, type BankAppsResponse, type BankAppsSource } from "@/lib/vietqr/bankApps";

import { apiGet } from "./client";

/** Live registry from the API. Throws on an invalid body. */
export const liveSource: BankAppsSource = {
  load: async () => {
    const data = parseBankAppsResponse(await apiGet<unknown>("/banks/apps"));
    if (!data) throw new Error("invalid /banks/apps response");
    return data;
  },
};

/** Never throws: any failure (no URL, timeout, network, HTTP error, bad shape) becomes null. */
export async function fetchBankApps(): Promise<BankAppsResponse | null> {
  try {
    return await liveSource.load();
  } catch {
    return null;
  }
}

/** Live registry when the API answers, else the bundled snapshot. Never exposes an error. */
export function useBankApps(): BankAppsResponse {
  const e2e = isE2E();
  const { data } = useQuery<BankAppsResponse | null>({
    queryKey: ["banks", "apps"],
    queryFn: fetchBankApps,
    enabled: !e2e,
    retry: false,
    staleTime: 6 * 60 * 60 * 1000,
  });
  return (!e2e && data) || SNAPSHOT;
}

/** The payment-app catalogue for screens: banks from the live registry (bundled snapshot until it answers) plus wallets. */
export function usePayApps(): PayApp[] {
  const data = useBankApps();
  return useMemo(() => buildPayApps(data, Platform.OS === "ios" ? "ios" : "android"), [data]);
}
