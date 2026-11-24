import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { SNAPSHOT, type BankAppsResponse } from "@/lib/vietqr/bankApps";

import { useBankApps } from "../bankApps";

const original = global.fetch;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function mockFetch(impl: (...a: unknown[]) => unknown) {
  const fn = jest.fn(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const LIVE: BankAppsResponse = {
  updated_at: "2026-11-25T00:00:00Z",
  stale: false,
  apps: [
    {
      app_id: "zzz",
      name: "ZZZ Bank",
      logo: null,
      bank_code: "ZZZ",
      bin: "970999",
      autofill: { android: true, ios: false },
      ios_scheme: null,
      android_package: null,
    },
  ],
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  process.env.EXPO_PUBLIC_APP_SECRET = "s3cret";
});
afterEach(() => {
  global.fetch = original;
  jest.useRealTimers();
});

describe("useBankApps", () => {
  it("AC1: returns the live list from GET /banks/apps", async () => {
    const fetchFn = mockFetch(async () => ({ ok: true, status: 200, json: async () => LIVE }));
    const { result } = await renderHook(() => useBankApps(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toEqual(LIVE));
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.test/banks/apps");
    const init = fetchFn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).toEqual(
      expect.arrayContaining(["x-device-id", "x-app-secret"]),
    );
  });

  const failures: [string, () => unknown][] = [
    ["429", async () => ({ ok: false, status: 429, json: async () => ({ error: "quota_exceeded" }) })],
    ["503", async () => ({ ok: false, status: 503, json: async () => ({ error: "banks_unavailable" }) })],
    [
      "offline",
      async () => {
        throw new Error("offline");
      },
    ],
    ["malformed body", async () => ({ ok: true, status: 200, json: async () => ({ apps: "x" }) })],
  ];
  it.each(failures)("AC3: %s falls back to the snapshot", async (_n, impl) => {
    const fetchFn = mockFetch(impl);
    const { result } = await renderHook(() => useBankApps(), { wrapper: wrapper() });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBe(SNAPSHOT);
  });

  it("AC3: a fetch that never resolves times out after 5 s and falls back to the snapshot", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    const fetchFn = mockFetch(() => new Promise(() => undefined));
    const { result } = await renderHook(() => useBankApps(), { wrapper: wrapper() });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(result.current).toBe(SNAPSHOT);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5100);
    });
    expect(result.current).toBe(SNAPSHOT);
  });

  it("AC4: in E2E mode it returns the snapshot and never calls fetch", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    try {
      const fetchFn = mockFetch(async () => ({ ok: true, status: 200, json: async () => LIVE }));
      const { result } = await renderHook(() => useBankApps(), { wrapper: wrapper() });
      await new Promise((r) => setTimeout(r, 20));
      expect(result.current).toBe(SNAPSHOT);
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_E2E;
    }
  });

  it("AC3: no API URL falls back to the snapshot", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchFn = mockFetch(async () => ({ ok: true, status: 200, json: async () => LIVE }));
    const { result } = await renderHook(() => useBankApps(), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBe(SNAPSHOT);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
