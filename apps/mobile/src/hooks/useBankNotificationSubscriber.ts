import { canOpenURL } from "expo-linking";
import { useEffect, useMemo } from "react";
import { AppState } from "react-native";

import { isAccessGranted, subscribe } from "../../modules/notification-listener";
import { useRepositories } from "@/db/RepositoriesProvider";
import { e2eCanOpen } from "@/e2e/installedApps";
import { isE2E } from "@/e2e/isE2E";
import { PAY_APPS } from "@/lib/payConfirm/apps";
import { resolveEnabled } from "@/lib/payConfirm/enabledApps";
import { detectInstalledApps } from "@/lib/payConfirm/installedApps";
import { createBankNotificationSubscriber } from "@/lib/bankNotifications/subscriber";
import { useAutoDetect } from "@/stores/autoDetect";

/** Keeps the bank-notification subscriber in step with the setting, access and the foreground state. */
export function useBankNotificationSubscriber() {
  const { preferences, paymentAppPrefs, handOffs } = useRepositories();
  const version = useAutoDetect((s) => s.version);
  const subscriber = useMemo(
    () =>
      createBankNotificationSubscriber({
        listener: { subscribe, isAccessGranted },
        preferences,
        paymentAppPrefs,
        handOffs,
        defaultEnabled: async () =>
          resolveEnabled({
            hasChosen: false,
            saved: [],
            installed: await detectInstalledApps(PAY_APPS, isE2E() ? e2eCanOpen : canOpenURL).catch(() => []),
          }),
        onMatched: ({ handOffId }) => useAutoDetect.getState().setMatched(handOffId),
      }),
    [preferences, paymentAppPrefs, handOffs],
  );

  useEffect(() => {
    void subscriber.sync();
  }, [subscriber, version]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void subscriber.sync();
    });
    return () => {
      sub.remove();
      subscriber.stop();
    };
  }, [subscriber]);
}
