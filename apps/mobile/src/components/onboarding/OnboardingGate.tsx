import { useRouter, usePathname } from "expo-router";
import { useEffect } from "react";

import { isE2E } from "@/e2e/isE2E";
import { readOnboardingOverride, useOnboardingOverride } from "@/e2e/onboardingOverride";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { onboardingRedirect } from "@/lib/onboarding/gate";

/** First-launch gate: sends the user to onboarding until `profile.onboarding_completed_at` is set. */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, completed } = useOnboardingStatus();
  const override = useOnboardingOverride((s) => s.override);
  const e2e = isE2E();
  useEffect(() => {
    if (e2e) readOnboardingOverride();
  }, [e2e]);
  const target = onboardingRedirect({ loading, completed, e2e, override, pathname });
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  return null;
}
