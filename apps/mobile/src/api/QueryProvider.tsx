import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AppState } from "react-native";

export const queryClient = new QueryClient();

export function QueryProvider({ children }: { children: ReactNode }) {
  // React Native has no window focus events: treat "app active" as focused so stale queries refetch on foreground.
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === "active");
    const sub = AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
