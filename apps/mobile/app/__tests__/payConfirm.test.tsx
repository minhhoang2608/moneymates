import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { createAppSettingRepository, createCategoryRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { handOff } from "@/lib/payConfirm/handOff";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("@/lib/payConfirm/handOff", () => ({ handOff: jest.fn(async () => {}) }));

declare global {
  var __PAY_TEST_DB__: object;
}

const testDb = () => global.__PAY_TEST_DB__ as unknown as AnyDb;

const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
const original = global.fetch;
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

describe("pay-confirm screen", () => {
  beforeEach(() => {
    jest.mocked(handOff).mockReset();
    jest.mocked(handOff).mockImplementation(async () => {});
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pay-")), "test.db");
    global.__PAY_TEST_DB__ = openTestDb(file).db;
  });

  it("AC1: dynamic code is prefilled", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    expect(await screen.findByText("NGUYEN VAN A")).toBeTruthy();
    expect(screen.getByText("TPBank · 0123456789")).toBeTruthy();
    expect(screen.getByTestId("pay-amount").props.value).toBe("55000");
    expect(screen.getByTestId("pay-note").props.value).toBe("PHO 24");
    expect(screen.getByText("Thanh toán 55.000đ qua TPBank")).toBeTruthy();
  });

  it.each([
    ["static", qr.static],
    ["merchant", qr.merchant],
  ])("AC2/AC4: %s code starts empty and disabled until an amount is typed", async (_n, text) => {
    await renderRouter("./app", { initialUrl: urlFor(text) });
    const amount = await screen.findByTestId("pay-amount");
    expect(amount.props.value).toBe("");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(amount, "55000");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(false);
  });

  it("AC4: merchant code (no amount) is still saved with its payload", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.merchant) });
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "55000");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1));
    const rows = await createTransactionRepository(testDb()).list();
    expect(rows).toHaveLength(1);
    expect(rows[0].qr_data).toBe(qr.merchant);
    expect(rows[0].source).toBe("qr");
    expect(rows[0].amount).toBe(55000);
  });

  it("AC3/AC5: submit saves one qr expense before hand-off; chosen app is remembered", async () => {
    const txRepo = createTransactionRepository(testDb());
    const other = (await createCategoryRepository(testDb()).listByKind("expense")).find((c) => c.name === "Khác");
    let atHandOff: Awaited<ReturnType<typeof txRepo.list>> = [];
    jest.mocked(handOff).mockImplementation(async () => {
      atHandOff = await txRepo.list();
    });

    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("app-mb"));
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1));
    expect(jest.mocked(handOff).mock.calls[0][0].id).toBe("mb");
    expect(jest.mocked(handOff).mock.calls[0][1]).toBe(qr.dynamic);

    // The row existed when the hand-off ran.
    expect(atHandOff).toHaveLength(1);
    const rows = await txRepo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: 55000,
      currency: "VND",
      source: "qr",
      qr_data: qr.dynamic,
      category_id: other?.id,
    });
    expect(other).toBeTruthy();

    // AC5: remembered, and listed first on the next visit.
    expect(await createAppSettingRepository(testDb()).get("pay.recent_apps")).toEqual(["mb"]);
  });

  it("AC5: a remembered app is listed first and preselected", async () => {
    await createAppSettingRepository(testDb()).set("pay.recent_apps", ["mb"]);
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy());
    const ids = screen.getAllByTestId(/^app-/).map((n) => n.props.testID);
    expect(ids[0]).toBe("app-mb");
  });
});
