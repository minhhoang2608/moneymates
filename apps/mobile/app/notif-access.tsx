import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { NotifAccessExplainer } from "@/components/notifAccess/NotifAccessExplainer";
import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { useNotifAccessOptIn } from "@/hooks/useNotifAccessOptIn";
import { PAY_APPS } from "@/lib/payConfirm/apps";

/** Explainer + opt-in for reading bank notifications (Android only). */
export default function NotifAccessScreen() {
  const router = useRouter();
  const { enabled } = useEnabledPayApps();
  const isAndroid = Platform.OS === "android";
  const { start, later } = useNotifAccessOptIn(() => router.back());

  useEffect(() => {
    if (!isAndroid) router.back();
  }, [isAndroid, router]);
  if (!isAndroid) return null;

  const names = enabled.map((id) => PAY_APPS.find((a) => a.id === id)?.name).filter((n): n is string => !!n);
  const leave = () => {
    void later().finally(() => router.back());
  };
  return <NotifAccessExplainer appNames={names} onContinue={() => void start()} onLater={leave} onClose={leave} />;
}
