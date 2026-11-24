import { useRouter } from "expo-router";

import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { PAY_APPS } from "@/lib/payConfirm/apps";
import { PermissionsStep } from "@/components/onboarding/PermissionsStep";

/** Step 3/4 of onboarding. The flow (#302) will replace the back navigation with the real next/skip. */
export default function OnboardingPermissionsScreen() {
  const router = useRouter();
  const { enabled } = useEnabledPayApps();
  const names = enabled.map((id) => PAY_APPS.find((a) => a.id === id)?.name).filter((n): n is string => !!n);
  return (
    <PermissionsStep
      onNext={() => router.back()}
      onSkip={() => router.back()}
      bankNotifAppNames={names}
      onOpenBankNotif={() => router.push("/notif-access")}
    />
  );
}
