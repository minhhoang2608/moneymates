import { useRouter } from "expo-router";
import { useCallback } from "react";

import { useMarkOnboardingCompleted } from "@/hooks/useOnboardingStatus";

/** Marks onboarding completed, then lands on Tổng quan. */
export function useFinishOnboarding() {
  const router = useRouter();
  const { mutateAsync } = useMarkOnboardingCompleted();
  return useCallback(async () => {
    await mutateAsync();
    router.replace("/");
  }, [mutateAsync, router]);
}
