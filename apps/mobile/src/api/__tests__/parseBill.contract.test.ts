import { configureDeviceIdStore } from "../deviceId";
import { parseBill } from "../parseBill";
import { createE2eBillImageSource } from "@/e2e/bill";

import fixture from "../../../e2e/fixtures/bill.json";

const { contract, response } = fixture;
const mem = new Map<string, unknown>();
const fetchMock = jest.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const lower = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
const CATEGORIES = ["Ăn uống", "Cà phê", "Khác"];

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
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_APP_SECRET;
  delete process.env.EXPO_PUBLIC_E2E;
  configureDeviceIdStore(null);
});

describe("parseBill contract", () => {
  it("AC1: sends the contract request", async () => {
    fetchMock.mockResolvedValue(ok(response));
    const append = jest.spyOn(FormData.prototype, "append");
    try {
      await parseBill("file:///bill.jpg", CATEGORIES);
      const fields = append.mock.calls.map((c) => c[0]);
      expect(fields).toEqual(contract.fields);
      // The image is an expo-file-system File (a Blob-like part); its name and type come from the file itself.
      expect(append).toHaveBeenCalledWith("image", expect.objectContaining({ uri: "file:///bill.jpg" }));
      expect(append).toHaveBeenCalledWith("categories", JSON.stringify(CATEGORIES));
    } finally {
      append.mockRestore();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.test${contract.path}`);
    expect(init.method).toBe("POST");
    const h = lower(init.headers);
    for (const name of contract.headers) expect(h[name.toLowerCase()]).toBeTruthy();
    expect(h).not.toHaveProperty("content-type");
  });

  it("AC2: fixture response survives normalisation", async () => {
    fetchMock.mockResolvedValue(ok(response));
    const out = await parseBill("file:///bill.jpg", [...CATEGORIES]);
    expect(out).toEqual(response);
    expect(Object.keys(out).sort()).toEqual([...contract.responseKeys].sort());
  });

  it("AC2: all-null response gives nulls and VND", async () => {
    fetchMock.mockResolvedValue(ok({ amount: null, currency: "VND", shop: null, date: null, category: null }));
    expect(await parseBill("file:///bill.jpg", CATEGORIES)).toEqual({
      amount: null,
      currency: "VND",
      shop: null,
      date: null,
      category: null,
    });
  });

  it("AC4: E2E mode never hits the network", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    const source = createE2eBillImageSource();
    expect(await parseBill((await source.capture()) as string, CATEGORIES)).toEqual(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
