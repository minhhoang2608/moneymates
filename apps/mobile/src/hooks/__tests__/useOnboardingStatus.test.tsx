import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";

import { useMarkOnboardingCompleted, useOnboardingStatus, useResetOnboarding } from "../useOnboardingStatus";

async function setup() {
  const { db } = openTestDb();
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  function W({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <RepositoriesProvider db={db as unknown as AnyDb}>{children}</RepositoriesProvider>
      </QueryClientProvider>
    );
  }
  return await renderHook(
    () => ({ status: useOnboardingStatus(), mark: useMarkOnboardingCompleted(), reset: useResetOnboarding() }),
    { wrapper: W },
  );
}

describe("useOnboardingStatus", () => {
  it("AC4: loads, then reflects mark and reset without a manual refetch", async () => {
    const { result } = await setup();
    expect(result.current.status.loading).toBe(true);
    await waitFor(() => expect(result.current.status.loading).toBe(false));
    expect(result.current.status.completed).toBe(false);

    await act(async () => {
      await result.current.mark.mutateAsync();
    });
    await waitFor(() => expect(result.current.status.completed).toBe(true));

    await act(async () => {
      await result.current.reset.mutateAsync();
    });
    await waitFor(() => expect(result.current.status.completed).toBe(false));
  });
});
