import { Text } from "react-native";

import { OnboardingStep, onboardingTextStyles } from "@/components/onboarding/OnboardingStep";
import { useFinishOnboarding } from "@/hooks/useFinishOnboarding";
import { vi } from "@/i18n/vi";

/** Onboarding step 4/4 (receiving account). Placeholder body: the step 4 ticket fills it in. */
export default function OnboardingAccountScreen() {
  const finish = useFinishOnboarding();
  const done = () => void finish();
  return (
    <OnboardingStep step={4} onNext={done} onSkip={done} testID="onboarding-account">
      <Text style={onboardingTextStyles.title}>{vi.onboarding.account.title}</Text>
    </OnboardingStep>
  );
}
