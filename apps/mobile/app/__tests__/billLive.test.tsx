import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { setApiAdapter } from "@/api/adapter";
import { configureDeviceIdStore } from "@/api/deviceId";
import { MULTIPART_TIMEOUT_MS } from "@/api/constants";
import { queryClient } from "@/api/QueryProvider";
import { createAppSettingRepository, createCategoryRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setBillImageSource } from "@/lib/bill/imageSource";
import { vi } from "@/i18n/vi";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__BILL_LIVE_DB__ as never)[key] });
  return { db };
});

declare global {
  var __BILL_LIVE_DB__: object;
}

let file: string;
const d = () => openTestDb(file).db as unknown as AnyDb;
const original = global.fetch;
const source = { capture: jest.fn(async () => "file:///bill.jpg"), pick: jest.fn(async () => "file:///pick.jpg") };
const mem = new Map<string, unknown>();
let features = { ai_enabled: true, ai_parse_text: true, ai_parse_bill: true };
let billReply: () => Promise<unknown>;
const fetchMock = jest.fn();

beforeEach(async () => {
  delete process.env.EXPO_PUBLIC_E2E;
  process.env.EXPO_PUBLIC_API_URL = "https://api.test";
  process.env.EXPO_PUBLIC_APP_SECRET = "s3cret";
  mem.clear();
  configureDeviceIdStore({
    get: async <T,>(k: string) => (mem.has(k) ? (mem.get(k) as T) : null),
    set: async (k: string, v: unknown) => void mem.set(k, v),
  });
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-billlive-")), "test.db");
  global.__BILL_LIVE_DB__ = openTestDb(file).db;
  jest.clearAllMocks();
  fetchMock.mockReset();
  features = { ai_enabled: true, ai_parse_text: true, ai_parse_bill: true };
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith("/me/features") ? { ok: true, status: 200, json: async () => features } : billReply(),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  setApiAdapter(null); // real liveAdapter
  queryClient.clear();
  setBillImageSource(source);
  await createAppSettingRepository(d()).set("bill_privacy_accepted", true);
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = original;
  setApiAdapter(null);
  setBillImageSource(null);
  configureDeviceIdStore(null);
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_APP_SECRET;
});

const billCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/ai/parse-bill"));

async function expectManualFallback(message: string) {
  expect(await screen.findByTestId("bill-error")).toHaveTextContent(message);
  await fireEvent.press(screen.getByTestId("bill-manual"));
  await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
  const other = (await createCategoryRepository(d()).listByKind("expense")).find((c) => c.name === "Khác")!;
  expect(screen).toHaveSearchParams({
    source: "bill",
    categoryId: other.id,
    attachmentUri: expect.stringMatching(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/),
  });
}

describe("bill scan through the live adapter", () => {
  it.each([
    [429, "quota_exceeded"],
    [502, "ai_unavailable"],
    [403, "ai_disabled"],
  ] as const)("AC3: HTTP %i shows the short message and falls back to manual entry", async (status, code) => {
    billReply = async () => ({ ok: false, status, json: async () => ({ error: code }) });
    await renderRouter("./app", { initialUrl: "/bill" });
    await expectManualFallback(vi.apiErrors[code]);
    expect(billCalls()).toHaveLength(1);
  });

  it("AC3: a non-JSON 502 body falls back on the status code", async () => {
    billReply = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });
    await renderRouter("./app", { initialUrl: "/bill" });
    await expectManualFallback(vi.apiErrors.ai_unavailable);
  });

  it("AC3: a request that never answers times out with the short message", async () => {
    billReply = () => new Promise(() => undefined);
    jest.useFakeTimers({ advanceTimers: true });
    await renderRouter("./app", { initialUrl: "/bill" });
    await waitFor(() => expect(billCalls()).toHaveLength(1));
    await act(async () => {
      jest.advanceTimersByTime(MULTIPART_TIMEOUT_MS + 1);
    });
    await expectManualFallback(vi.apiErrors.timeout);
  });

  it("AC3: with AI disabled nothing is sent to /ai/parse-bill", async () => {
    features = { ai_enabled: false, ai_parse_text: false, ai_parse_bill: false };
    billReply = async () => {
      throw new Error("must not be called");
    };
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-error")).toBeTruthy();
    expect(billCalls()).toHaveLength(0);
    expect(source.capture).not.toHaveBeenCalled();
  });
});
