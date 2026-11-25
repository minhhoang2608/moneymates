import { useRouter } from "expo-router";
import { Text } from "react-native";

import { OnboardingStep, onboardingTextStyles } from "@/components/onboarding/OnboardingStep";
import { vi } from "@/i18n/vi";

/** Onboarding step 2/4 (payment apps). Placeholder body: the step 2 ticket fills it in. */
export default function OnboardingAppsScreen() {
  const router = useRouter();
  const next = () => router.push("/onboarding/permissions");
  return (
    <OnboardingStep step={2} onNext={next} onSkip={next} testID="onboarding-apps">
      <Text style={onboardingTextStyles.title}>{vi.onboarding.apps.title}</Text>
    </OnboardingStep>
  );
}
