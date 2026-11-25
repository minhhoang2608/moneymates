import { canOpenURL } from "expo-linking";

import { e2eCanOpen } from "@/e2e/installedApps";
import { isE2E } from "@/e2e/isE2E";

import { PAY_APPS } from "./apps";
import { detectInstalledApps } from "./installedApps";

/** Ids of the pay apps installed on this phone (E2E: fixture). Any failure means "none detected". */
export async function getInstalledPayApps(): Promise<string[]> {
  try {
    return await detectInstalledApps(PAY_APPS, isE2E() ? e2eCanOpen : canOpenURL);
  } catch {
    return [];
  }
}
