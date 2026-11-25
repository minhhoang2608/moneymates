import * as Linking from "expo-linking";
import { create } from "zustand";

type State = { override: boolean; set: (v: boolean) => void };

/** E2E launch override: `moneymates:///onboarding?e2e_onboarding=1` shows onboarding even with EXPO_PUBLIC_E2E=1. */
export const useOnboardingOverride = create<State>((set) => ({
  override: false,
  set: (override) => set({ override }),
}));

export function hasOnboardingOverride(url: string | null): boolean {
  return url != null && /[?&]e2e_onboarding=1(&|#|$)/.test(url);
}

let started = false;
let readLaunchUrl: () => Promise<string | null> = () => Linking.getInitialURL();
/** Test seam: replaces the launch-URL reader. */
export function setLaunchUrlReader(reader: (() => Promise<string | null>) | null): void {
  readLaunchUrl = reader ?? (() => Linking.getInitialURL());
}
/** Reads the launch URL once and turns the override on when it asks for it. */
export function readOnboardingOverride(): void {
  if (started) return;
  started = true;
  readLaunchUrl()
    .then((url) => {
      if (hasOnboardingOverride(url)) useOnboardingOverride.getState().set(true);
    })
    .catch(() => undefined);
}

export function resetOnboardingOverrideForTests(): void {
  started = false;
  useOnboardingOverride.getState().set(false);
}
