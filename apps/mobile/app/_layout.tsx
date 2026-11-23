import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";

import { QueryProvider } from "@/api/QueryProvider";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { RepositoriesProvider } from "@/db/RepositoriesProvider";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  if (!loaded && !error) return null;

  return (
    <QueryProvider>
      <DatabaseProvider>
        <RepositoriesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scan" options={{ presentation: "modal" }} />
            <Stack.Screen name="pay-confirm" />
            <Stack.Screen name="bank-accounts" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="group/[id]" />
            <Stack.Screen name="group/summary" />
            <Stack.Screen name="group/edit" options={{ presentation: "modal" }} />
            <Stack.Screen name="transaction/[id]" />
            <Stack.Screen name="transaction/new" options={{ presentation: "modal" }} />
          </Stack>
        </RepositoriesProvider>
      </DatabaseProvider>
    </QueryProvider>
  );
}
