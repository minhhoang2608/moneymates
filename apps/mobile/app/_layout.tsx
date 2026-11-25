import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";

import { Toast } from "@/components/Toast";
import { AppLockGate } from "@/components/appLock/AppLockGate";
import { ReturnBanner } from "@/components/payConfirm/ReturnBanner";
import { QueryProvider } from "@/api/QueryProvider";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { E2eNotificationInjector } from "@/e2e/NotificationInjector";
import { isE2E } from "@/e2e/isE2E";
import { useBankNotificationSubscriber } from "@/hooks/useBankNotificationSubscriber";
import { setCurrentPath } from "@/lib/receipt/currentPath";
import { stackScreenOptions, useReduceMotion } from "@/lib/motion";

function BankNotificationWiring() {
  useBankNotificationSubscriber();
  return isE2E() ? <E2eNotificationInjector /> : null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const reduceMotion = useReduceMotion();
  const pathname = usePathname();
  useEffect(() => {
    setCurrentPath(pathname);
  }, [pathname]);
  if (!loaded && !error) return null;

  return (
    <QueryProvider>
      <DatabaseProvider>
        <RepositoriesProvider>
          <BankNotificationWiring />
          <AppLockGate>
            <Stack screenOptions={stackScreenOptions(reduceMotion)}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="scan" options={{ presentation: "modal" }} />
              <Stack.Screen name="pay-confirm" />
              <Stack.Screen name="bank-accounts" />
              <Stack.Screen name="categories" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="onboarding/permissions" />
              <Stack.Screen name="payment-apps" />
              <Stack.Screen name="notif-access" />
              <Stack.Screen name="stats" />
              <Stack.Screen name="group/[id]" />
              <Stack.Screen name="group/summary" />
              <Stack.Screen name="group/edit" options={{ presentation: "modal" }} />
              <Stack.Screen name="transaction/[id]" />
              <Stack.Screen name="transaction/new" options={{ presentation: "modal" }} />
            </Stack>
            <ReturnBanner />
            <Toast />
          </AppLockGate>
        </RepositoriesProvider>
      </DatabaseProvider>
    </QueryProvider>
  );
}
