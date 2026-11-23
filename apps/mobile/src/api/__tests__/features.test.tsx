import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { DEFAULT_FEATURES, useFeatures } from "../features";

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

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
});
afterEach(() => {
  global.fetch = original;
  jest.useRealTimers();
});

describe("useFeatures", () => {
  it("AC3: returns server flags from GET /me/features", async () => {
    const fetchFn = mockFetch(async () => ({
      ok: true,
      json: async () => ({ ai_enabled: true, ai_parse_text: true, ai_parse_bill: false }),
    }));
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ai_enabled).toBe(true));
    expect(result.current).toEqual({
      ai_enabled: true,
      ai_parse_text: true,
      ai_parse_bill: false,
    });
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.test/me/features");
  });

  it("AC4: falls back to defaults when the request rejects", async () => {
    const fetchFn = mockFetch(async () => {
      throw new Error("offline");
    });
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(result.current).toEqual(DEFAULT_FEATURES);
  });

  it("AC4: falls back to defaults on a non-OK response or malformed JSON", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    }));
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current).toEqual(DEFAULT_FEATURES);
  });

  it("AC4: falls back to defaults on timeout", async () => {
    jest.useFakeTimers();
    mockFetch(() => new Promise(() => {}));
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await jest.advanceTimersByTimeAsync(6000);
    expect(result.current).toEqual(DEFAULT_FEATURES);
  });

  it("AC4: missing or non-boolean fields use defaults", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ ai_enabled: true, ai_parse_text: "yes" }),
    }));
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ai_enabled).toBe(true));
    expect(result.current.ai_parse_text).toBe(false);
    expect(result.current.ai_parse_bill).toBe(false);
  });

  it("AC5: with no API URL configured no request is made", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchFn = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    const { result } = await renderHook(() => useFeatures(), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current).toEqual(DEFAULT_FEATURES);
  });
});
