import { apiGet, apiPost, apiPostMultipart, DEFAULT_TIMEOUT_MS, MULTIPART_TIMEOUT_MS } from "../client";
import { configureDeviceIdStore } from "../deviceId";
import { ApiError } from "../errors";

const mem = new Map<string, unknown>();
const fetchMock = jest.fn();

beforeEach(() => {
  mem.clear();
  configureDeviceIdStore({
    get: async <T>(k: string) => (mem.has(k) ? (mem.get(k) as T) : null),
    set: async (k: string, v: unknown) => void mem.set(k, v),
  });
  process.env.EXPO_PUBLIC_API_URL = "https://api.test";
  process.env.EXPO_PUBLIC_APP_SECRET = "s3cret";
  delete process.env.EXPO_PUBLIC_E2E;
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_APP_SECRET;
  configureDeviceIdStore(null);
});

const fails = (p: Promise<unknown>): Promise<ApiError> =>
  p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e as ApiError,
  );
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });
const lower = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

describe("api client", () => {
  it("AC1: apiPost sends JSON with auth headers", async () => {
    fetchMock.mockResolvedValue(ok({ amount: 50000 }));
    const body = { text: "50k cafe", categories: ["Ăn uống"] };
    expect(await apiPost("/ai/parse-text", body)).toEqual({ amount: 50000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/ai/parse-text");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(body));
    const h = lower(init.headers);
    expect(h["x-app-secret"]).toBe("s3cret");
    expect(h["x-device-id"]).toMatch(/\S+/);
    expect(h["content-type"]).toBe("application/json");
  });

  it("AC2: apiPostMultipart sends the FormData with no content-type", async () => {
    fetchMock.mockResolvedValue(ok({}));
    const form = new FormData();
    form.append("categories", "x");
    await apiPostMultipart("/ai/parse-bill", form);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    const h = lower(init.headers);
    expect(h["x-app-secret"]).toBe("s3cret");
    expect(h["x-device-id"]).toBeTruthy();
    expect(h).not.toHaveProperty("content-type");
  });

  it("apiGet sends auth headers", async () => {
    fetchMock.mockResolvedValue(ok({ a: 1 }));
    expect(await apiGet("/me/features")).toEqual({ a: 1 });
    expect(lower(fetchMock.mock.calls[0][1].headers)["x-device-id"]).toBeTruthy();
  });

  it("sends the same device id on every request", async () => {
    fetchMock.mockResolvedValue(ok({}));
    await apiPost("/a", {});
    await apiGet("/b");
    const ids = fetchMock.mock.calls.map((c) => lower(c[1].headers)["x-device-id"]);
    expect(ids[0]).toBe(ids[1]);
  });

  describe("AC4: error mapping", () => {
    const cases: [string, number, string][] = [
      ["400", 400, "invalid_input"],
      ["401", 401, "unauthorized"],
      ["403 ai_disabled", 403, "ai_disabled"],
      ["429 quota_exceeded", 429, "quota_exceeded"],
      ["502 ai_unavailable", 502, "ai_unavailable"],
    ];
    const messages = new Set<string>();

    it.each(cases)("%s", async (_n, status, code) => {
      fetchMock.mockResolvedValue(fail(status, { error: code }));
      const err = await fails(apiPost("/x", {}));
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(status);
      expect(err.code).toBe(code);
      expect(err.message).toBeTruthy();
      messages.add(err.message);
    });

    it("maps by status when the body has no error code", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => Promise.reject(new Error("x")) });
      const err = await fails(apiPost("/x", {}));
      expect(err.code).toBe("quota_exceeded");
    });

    it("unknown status maps to http_error", async () => {
      fetchMock.mockResolvedValue(fail(500, {}));
      expect((await fails(apiGet("/x"))).code).toBe("http_error");
    });

    it("network error", async () => {
      fetchMock.mockRejectedValue(new TypeError("Network request failed"));
      const err = await fails(apiPost("/x", {}));
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe("network");
      messages.add(err.message);
    });

    it("a 200 response that is not JSON is an http_error, not a network error", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => Promise.reject(new SyntaxError("bad json")),
      });
      expect((await fails(apiPost("/x", {}))).code).toBe("http_error");
    });

    it("timeout aborts the request", async () => {
      jest.useFakeTimers();
      let signal: AbortSignal | undefined;
      fetchMock.mockImplementation((_u, init) => {
        signal = init.signal;
        return new Promise(() => undefined);
      });
      const p = fails(apiPost("/x", {}));
      await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
      const err = await p;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe("timeout");
      expect(signal?.aborted).toBe(true);
      messages.add(err.message);
    });

    it("all 7 messages are distinct", () => {
      expect(messages.size).toBe(7);
    });
  });

  describe("timeouts", () => {
    it("multipart default is longer than JSON", () => {
      expect(MULTIPART_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
    });

    it("multipart survives the JSON timeout, per-call override applies", async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(() => new Promise(() => undefined));
      const slow = fails(apiPostMultipart("/x", new FormData()));
      const quick = fails(apiPostMultipart("/x", new FormData(), { timeoutMs: 100 }));
      await jest.advanceTimersByTimeAsync(101);
      expect((await quick).code).toBe("timeout");
      await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
      let settled = false;
      void slow.then(() => (settled = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(MULTIPART_TIMEOUT_MS);
      expect((await slow).code).toBe("timeout");
    });
  });

  it("missing API URL throws not_configured without fetch", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const err = await fails(apiPost("/x", {}));
    expect(err.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
