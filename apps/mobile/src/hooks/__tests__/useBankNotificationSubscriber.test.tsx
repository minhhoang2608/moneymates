import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createPreferencesRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { useAutoDetect } from "@/stores/autoDetect";

import { useBankNotificationSubscriber } from "../useBankNotificationSubscriber";

const unsub = jest.fn();
const mockSubscribe = jest.fn((..._a: unknown[]) => unsub);
jest.mock("../../../modules/notification-listener", () => ({
  isAccessGranted: async () => true,
  subscribe: (...a: unknown[]) => mockSubscribe(...a),
}));

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

describe("useBankNotificationSubscriber", () => {
  it("re-syncs on bump and stops on unmount", async () => {
    const { db } = openTestDb();
    const prefs = createPreferencesRepository(db as unknown as AnyDb);
    await prefs.setAutoDetectTransfers(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepositoriesProvider db={db as unknown as AnyDb}>{children}</RepositoriesProvider>
    );
    const { unmount } = await renderHook(() => useBankNotificationSubscriber(), { wrapper });
    await flush();
    expect(mockSubscribe).not.toHaveBeenCalled();
    await prefs.setAutoDetectTransfers(true);
    await act(async () => useAutoDetect.getState().bump());
    await flush();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    await unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
