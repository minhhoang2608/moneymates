import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";

import { Toast } from "@/components/Toast";
import { AppLockGate } from "@/components/appLock/AppLockGate";
import { ReturnBanner } from "@/components/payConfirm/ReturnBanner";
import { QueryProvider } from "@/api/QueryProvider";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { stackScreenOptions, useReduceMotion } from "@/lib/motion";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const reduceMotion = useReduceMotion();
  if (!loaded && !error) return null;

  return (
    <QueryProvider>
      <DatabaseProvider>
        <RepositoriesProvider>
          <AppLockGate>
            <Stack screenOptions={stackScreenOptions(reduceMotion)}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="scan" options={{ presentation: "modal" }} />
              <Stack.Screen name="pay-confirm" />
              <Stack.Screen name="bank-accounts" />
              <Stack.Screen name="categories" />
              <Stack.Screen name="settings" />
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
