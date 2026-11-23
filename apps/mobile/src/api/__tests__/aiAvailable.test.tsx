import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { e2eFeatures } from "@/e2e/fixtures";

import { useAiAvailable, useFeatures } from "../features";

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

const ok = (body: unknown) => async () => ({ ok: true, json: async () => body });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
});
afterEach(() => {
  global.fetch = original;
  delete process.env.EXPO_PUBLIC_E2E;
  jest.useRealTimers();
});

describe("useAiAvailable", () => {
  it("AC1: AI off → unavailable, reason disabled", async () => {
    mockFetch(ok({ ai_enabled: false, ai_parse_text: true, ai_parse_bill: true }));
    const { result } = await renderHook(() => useAiAvailable(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.reason).toBe("disabled"));
    expect(result.current.available).toBe(false);
  });

  it("AC1: per-feature flag off → unavailable", async () => {
    mockFetch(ok({ ai_enabled: true, ai_parse_text: true, ai_parse_bill: false }));
    const { result } = await renderHook(() => useAiAvailable("parse_bill"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.reason).toBe("disabled"));
    expect(result.current.available).toBe(false);
  });

  it("AC2: network error → offline, no throw", async () => {
    mockFetch(async () => {
      throw new Error("Network request failed");
    });
    const { result } = await renderHook(() => useAiAvailable(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.reason).toBe("offline"));
    expect(result.current.available).toBe(false);
  });

  it("AC2: non-OK status → offline", async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = await renderHook(() => useAiAvailable(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.reason).toBe("offline"));
  });

  it("AC2: timeout → offline", async () => {
    jest.useFakeTimers();
    mockFetch(() => new Promise(() => {}));
    const { result } = await renderHook(() => useAiAvailable(), { wrapper: wrapper() });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });
    expect(result.current).toEqual({ available: false, reason: "offline" });
  });

  it("AC3: AI on → available, reason null", async () => {
    mockFetch(ok({ ai_enabled: true, ai_parse_text: true, ai_parse_bill: true }));
    const { result } = await renderHook(() => useAiAvailable("parse_text"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.reason).toBeNull();
  });

  it("AC3: pending → unavailable, loading", async () => {
    mockFetch(() => new Promise(() => {}));
    const { result } = await renderHook(() => useAiAvailable(), { wrapper: wrapper() });
    expect(result.current).toEqual({ available: false, reason: "loading" });
  });

  it("AC4: E2E returns the fixture without fetch", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    const fetchFn = mockFetch(ok({}));
    const { result } = await renderHook(() => ({ ai: useAiAvailable("parse_bill"), f: useFeatures() }), {
      wrapper: wrapper(),
    });
    expect(result.current.ai).toEqual({ available: true, reason: null });
    expect(result.current.f).toEqual(e2eFeatures);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
