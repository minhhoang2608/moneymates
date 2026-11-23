import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { createCategoryRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
const mockHandOff = jest.fn();
jest.mock("@/lib/payConfirm/handOffDeps", () => ({
  makeHandOff: jest.fn(
    () =>
      (...args: unknown[]) =>
        mockHandOff(...args),
  ),
}));

declare global {
  var __PAY_TEST_DB__: object;
}

const testDb = () => global.__PAY_TEST_DB__ as unknown as AnyDb;
const original = global.fetch;
const fetchMock = jest.fn();

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};
const qrWithMessage = (msg: string) => {
  const r = scanResultToRoute(qr.dynamic);
  if (!r.ok) throw new Error("expected ok");
  const p = new URLSearchParams(r.href.params);
  p.set("message", msg);
  return `/pay-confirm?${p.toString()}`;
};

const featuresOk = {
  ok: true,
  status: 200,
  json: async () => ({ ai_enabled: true, ai_parse_text: true, ai_parse_bill: true }),
};
const parsed = (category: string | null) => ({
  ok: true,
  status: 200,
  json: async () => ({ amount: null, currency: "VND", note: null, category, payer: null }),
});
const route = (parse: () => unknown, features: unknown = featuresOk) =>
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/me/features") ? Promise.resolve(features) : Promise.resolve(parse()),
  );
const parseCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/ai/parse-text"));

const idOf = async (name: string) =>
  (await createCategoryRepository(testDb()).listByKind("expense")).find((c) => c.name === name)!.id;
const selected = (id: string) => screen.getByTestId(`pay-category-${id}`).props.accessibilityState.selected;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
  mockHandOff.mockReset();
  mockHandOff.mockImplementation(async () => ({ opened: true }));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-paycat-")), "test.db");
  global.__PAY_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => {
  global.fetch = original;
  delete process.env.EXPO_PUBLIC_E2E;
});

describe("pay-confirm category preselection", () => {
  it.each([
    ["PHO 24", "Ăn uống"],
    ["GRAB 123456", "Di chuyển"],
    ["CAFE SANG", "Ăn uống"],
  ])("AC1/AC2: %s → %s without calling AI", async (msg, name) => {
    route(() => parsed(null));
    await renderRouter("./app", { initialUrl: qrWithMessage(msg) });
    const id = await idOf(name);
    await waitFor(() => expect(selected(id)).toBe(true));
    expect(parseCalls()).toHaveLength(0);
  });

  it("AC3: no keyword → AI picks a custom category", async () => {
    const created = await createCategoryRepository(testDb()).create({
      name: "Cà phê",
      kind: "expense",
      icon: "coffee",
      color: "#0E7C66",
    });
    route(() => parsed("Cà phê"));
    await renderRouter("./app", { initialUrl: urlFor(qr.static) });
    await waitFor(() => expect(selected(created.id)).toBe(true));
    const body = JSON.parse((parseCalls()[0][1] as RequestInit).body as string);
    expect(body.categories).toContain("Cà phê");
  });

  it.each([
    ["429", () => ({ ok: false, status: 429, json: async () => ({ error: "quota_exceeded" }) }), featuresOk],
    ["502", () => ({ ok: false, status: 502, json: async () => ({ error: "ai_unavailable" }) }), featuresOk],
    ["403", () => ({ ok: false, status: 403, json: async () => ({ error: "ai_disabled" }) }), featuresOk],
    [
      "ai off",
      () => parsed("Ăn uống"),
      { ok: true, status: 200, json: async () => ({ ai_enabled: false, ai_parse_text: false, ai_parse_bill: false }) },
    ],
  ])("AC4: %s → Khác, submit still saves", async (_n, parse, features) => {
    route(parse, features);
    await renderRouter("./app", { initialUrl: urlFor(qr.static) });
    const other = await idOf("Khác");
    await waitFor(() => expect(selected(other)).toBe(true));
    await fireEvent.changeText(screen.getByTestId("pay-amount"), "55000");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect((await createTransactionRepository(testDb()).list())[0].category_id).toBe(other);
  });

  it("payment never waits on a pending AI answer", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/me/features") ? Promise.resolve(featuresOk) : new Promise(() => {}),
    );
    await renderRouter("./app", { initialUrl: urlFor(qr.static) });
    const other = await idOf("Khác");
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "55000");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect((await createTransactionRepository(testDb()).list())[0].category_id).toBe(other);
  });

  it("a user tap wins over a late AI answer", async () => {
    let release: (v: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/me/features")
        ? Promise.resolve(featuresOk)
        : new Promise((r) => {
            release = r;
          }),
    );
    await renderRouter("./app", { initialUrl: qrWithMessage("tien nha thang nay") });
    const shop = await idOf("Di chuyển");
    const food = await idOf("Ăn uống");
    await fireEvent.press(await screen.findByTestId(`pay-category-${shop}`));
    await waitFor(() => expect(selected(shop)).toBe(true));
    await waitFor(() => expect(parseCalls()).toHaveLength(1));
    expect(parseCalls()).toHaveLength(1);
    release(parsed("Ăn uống"));
    for (let i = 0; i < 10; i++) await act(async () => {});
    expect(selected(shop)).toBe(true);
    expect(screen.getByTestId(`pay-category-${food}`).props.accessibilityState.selected).toBe(false);
  });

  it("AC6: E2E mode makes no network call", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    await renderRouter("./app", { initialUrl: urlFor(qr.static) });
    const other = await idOf("Khác");
    await waitFor(() => expect(selected(other)).toBe(true));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
