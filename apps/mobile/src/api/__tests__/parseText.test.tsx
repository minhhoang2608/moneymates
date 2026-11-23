import { DEFAULT_TIMEOUT_MS } from "../constants";
import { suggestCategoryByAi } from "../parseText";

const original = global.fetch;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
});
afterEach(() => {
  global.fetch = original;
  jest.useRealTimers();
});

const body = (category: string | null) => ({ amount: null, currency: "VND", note: null, category, payer: null });
const mock = (impl: () => unknown) => {
  const fn = jest.fn(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

describe("suggestCategoryByAi", () => {
  it("AC3: POSTs text and categories, returns the category", async () => {
    const fn = mock(async () => ({ ok: true, status: 200, json: async () => body("Cà phê") }));
    await expect(suggestCategoryByAi("ca phe", ["Ăn uống", "Cà phê"])).resolves.toBe("Cà phê");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/ai/parse-text");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ text: "ca phe", categories: ["Ăn uống", "Cà phê"] });
    expect((init.headers as Record<string, string>)["X-Device-Id"]).toBeTruthy();
  });

  it.each([429, 502, 403, 500])("AC4: HTTP %s → null", async (status) => {
    mock(async () => ({ ok: false, status, json: async () => ({ error: "x" }) }));
    await expect(suggestCategoryByAi("x", ["Khác"])).resolves.toBeNull();
  });

  it("AC4: network failure → null", async () => {
    mock(async () => {
      throw new Error("down");
    });
    await expect(suggestCategoryByAi("x", ["Khác"])).resolves.toBeNull();
  });

  it("AC4: timeout → null", async () => {
    jest.useFakeTimers();
    mock(() => new Promise(() => undefined));
    const p = suggestCategoryByAi("x", ["Khác"]);
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    await expect(p).resolves.toBeNull();
  });

  it("unknown category name → null", async () => {
    mock(async () => ({ ok: true, status: 200, json: async () => body("Lạ") }));
    await expect(suggestCategoryByAi("x", ["Khác"])).resolves.toBeNull();
  });
});
