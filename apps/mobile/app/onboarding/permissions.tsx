import { useRouter } from "expo-router";

import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { PAY_APPS } from "@/lib/payConfirm/apps";
import { PermissionsStep } from "@/components/onboarding/PermissionsStep";

/** Step 3/4 of onboarding. */
export default function OnboardingPermissionsScreen() {
  const router = useRouter();
  const { enabled } = useEnabledPayApps();
  const names = enabled.map((id) => PAY_APPS.find((a) => a.id === id)?.name).filter((n): n is string => !!n);
  return (
    <PermissionsStep
      onNext={() => router.push("/onboarding/account")}
      onSkip={() => router.push("/onboarding/account")}
      bankNotifAppNames={names}
      onOpenBankNotif={() => router.push("/notif-access")}
    />
  );
}
