import { useRouter } from "expo-router";

import { PermissionsStep } from "@/components/onboarding/PermissionsStep";

/** Step 3/4 of onboarding. The flow (#302) will replace the back navigation with the real next/skip. */
export default function OnboardingPermissionsScreen() {
  const router = useRouter();
  return <PermissionsStep onNext={() => router.back()} onSkip={() => router.back()} />;
}
