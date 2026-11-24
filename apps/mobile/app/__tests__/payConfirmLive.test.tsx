import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { queryClient } from "@/api/QueryProvider";
import { openTestDb } from "@/db/testing/testDb";
import { SNAPSHOT } from "@/lib/vietqr/bankApps";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("@/lib/payConfirm/handOffDeps", () => ({
  makeHandOff: jest.fn(() => async () => ({ opened: true })),
}));

declare global {
  var __PAY_TEST_DB__: object;
}

const original = global.fetch;
const LIVE = {
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
    ...SNAPSHOT.apps,
  ],
};

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  process.env.EXPO_PUBLIC_APP_SECRET = "s3cret";
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-paylive-")), "test.db");
  global.__PAY_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => {
  queryClient.clear();
  global.fetch = original;
});

describe("pay-confirm with the live bank apps list", () => {
  it("AC1: an app that only the live API knows shows up in the picker", async () => {
    const fetchFn = jest.fn(async (url: string) =>
      url.endsWith("/banks/apps")
        ? { ok: true, status: 200, json: async () => LIVE }
        : { ok: false, status: 503, json: async () => ({}) },
    );
    global.fetch = fetchFn as unknown as typeof fetch;
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await screen.findByTestId("pay-submit");
    await waitFor(() => expect(fetchFn.mock.calls.map((c) => c[0])).toContain("https://api.test/banks/apps"));
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    await fireEvent.changeText(await screen.findByTestId("pay-app-search"), "zzz");
    await fireEvent.press(await screen.findByTestId("app-zzz"));
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua ZZZ Bank")).toBeTruthy());
  });

  it("AC3: a 503 shows the bundled apps and no error text", async () => {
    const fetchFn = jest.fn(async (_url: string) => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "banks_unavailable" }),
    }));
    global.fetch = fetchFn as unknown as typeof fetch;
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await screen.findByTestId("pay-submit");
    await waitFor(() => expect(fetchFn.mock.calls.map((c) => c[0])).toContain("https://api.test/banks/apps"));
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    const search = await screen.findByTestId("pay-app-search");
    for (const a of SNAPSHOT.apps) {
      await fireEvent.changeText(search, a.app_id);
      expect(await screen.findByTestId(`app-${a.app_id}`)).toBeTruthy();
    }
    await fireEvent.changeText(search, "zzz");
    expect(screen.queryByTestId("app-zzz")).toBeNull();
    expect(screen.queryByText("banks_unavailable")).toBeNull();
    expect(screen.queryByText("503")).toBeNull();
  });
});
