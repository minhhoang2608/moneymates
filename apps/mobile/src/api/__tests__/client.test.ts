import { apiGet, apiPost, apiPostMultipart, DEFAULT_TIMEOUT_MS, MULTIPART_TIMEOUT_MS } from "../client";
import { resetDeviceIdCache, configureDeviceIdStore } from "../deviceId";
import { ApiError } from "../errors";

const original = global.fetch;
const memory = new Map<string, unknown>();

function mockFetch(impl: (...a: unknown[]) => unknown) {
  const fn = jest.fn(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const headersOf = (fn: jest.Mock) => (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  process.env.EXPO_PUBLIC_APP_SECRET = "secret";
  memory.clear();
  configureDeviceIdStore({
    get: async (k: string) => (memory.get(k) ?? null) as never,
    set: async (k: string, v: unknown) => void memory.set(k, v),
  });
});
afterEach(() => {
  global.fetch = original;
  delete process.env.EXPO_PUBLIC_APP_SECRET;
  jest.useRealTimers();
  resetDeviceIdCache();
});

describe("apiPost", () => {
  it("AC1: sends JSON with auth headers", async () => {
    const fn = mockFetch(async () => json(200, { amount: 50000 }));
    const res = await apiPost("/ai/parse-text", { text: "50k" });
    expect(res).toEqual({ amount: 50000 });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/ai/parse-text");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ text: "50k" }));
    const h = headersOf(fn);
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["X-App-Secret"]).toBe("secret");
    expect(h["X-Device-Id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("apiPostMultipart", () => {
  it("AC2: passes FormData through with no Content-Type", async () => {
    const fn = mockFetch(async () => json(200, { ok: 1 }));
    const form = new FormData();
    form.append("a", "b");
    await apiPostMultipart("/ai/parse-bill", form);
    expect((fn.mock.calls[0][1] as RequestInit).body).toBe(form);
    const h = headersOf(fn);
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain("content-type");
    expect(h["X-App-Secret"]).toBe("secret");
    expect(h["X-Device-Id"]).toBeTruthy();
  });

  it("uses the longer multipart timeout and honours overrides", async () => {
    expect(MULTIPART_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
    jest.useFakeTimers();
    mockFetch(() => new Promise(() => undefined));
    const form = new FormData();
    let err: unknown;
    apiPostMultipart("/x", form).catch((e) => (err = e));
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    expect(err).toBeUndefined();
    await jest.advanceTimersByTimeAsync(MULTIPART_TIMEOUT_MS);
    expect((err as ApiError).code).toBe("timeout");

    err = undefined;
    apiPostMultipart("/x", form, { timeoutMs: 100 }).catch((e) => (err = e));
    await jest.advanceTimersByTimeAsync(101);
    expect((err as ApiError).code).toBe("timeout");
  });
});

describe("error mapping", () => {
  const cases: [string, number, string][] = [
    ["invalid_input", 400, "invalid_input"],
    ["unauthorized", 401, "unauthorized"],
    ["ai_disabled", 403, "ai_disabled"],
    ["quota_exceeded", 429, "quota_exceeded"],
    ["ai_unavailable", 502, "ai_unavailable"],
  ];
  const messages = new Set<string>();

  it.each(cases)("AC4: %s", async (code, status) => {
    mockFetch(async () => json(status, { error: code }));
    const err = (await apiPost("/x", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
    expect(err.message).not.toBe("");
    messages.add(err.message);
  });

  it("AC4: timeout and network errors", async () => {
    jest.useFakeTimers();
    mockFetch(() => new Promise(() => undefined));
    let err: unknown;
    apiGet("/x").catch((e) => (err = e));
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    expect((err as ApiError).code).toBe("timeout");
    expect((err as ApiError).status).toBeNull();
    messages.add((err as ApiError).message);
    jest.useRealTimers();

    mockFetch(async () => {
      throw new TypeError("Network request failed");
    });
    const net = (await apiGet("/x").catch((e) => e)) as ApiError;
    expect(net.code).toBe("network");
    messages.add(net.message);
    expect(messages.size).toBe(7);
  });

  it("falls back on the status when the body has no known code", async () => {
    mockFetch(async () => json(429, {}));
    expect(((await apiPost("/x", {}).catch((e) => e)) as ApiError).code).toBe("quota_exceeded");
    mockFetch(async () => json(500, null));
    expect(((await apiPost("/x", {}).catch((e) => e)) as ApiError).code).toBe("http_error");
  });

  it("throws not_configured without calling fetch when the API URL is missing", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fn = mockFetch(async () => json(200, {}));
    expect(((await apiGet("/x").catch((e) => e)) as ApiError).code).toBe("not_configured");
    expect(fn).not.toHaveBeenCalled();
  });
});
