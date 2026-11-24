import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as Linking from "expo-linking";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  createAppSettingRepository,
  createHandOffMemoryRepository,
  createPaymentAppPrefsRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__SET_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "9.9.9" } },
}));

declare global {
  var __SET_TEST_DB__: object;
}

let file: string;
const fresh = () => openTestDb(file).db as unknown as AnyDb;

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-set-")), "test.db");
  global.__SET_TEST_DB__ = openTestDb(file).db;
});

async function open() {
  const view = await renderRouter("./app", { initialUrl: "/settings" });
  await screen.findByTestId("screen-settings", {}, { timeout: 5000 });
  await screen.findByTestId("settings-payment-apps-row");
  return view;
}
describe("Cài đặt default bank suggestion", () => {
  it("is hidden without hints", async () => {
    await open();
    expect(screen.queryByTestId("settings-default-suggest")).toBeNull();
  });

  it("accept moves the suggested app first and hides the card", async () => {
    await createAppSettingRepository(fresh()).set("pay.recent_apps", ["mb"]);
    await open();
    await screen.findByTestId("settings-default-suggest");
    await fireEvent.press(screen.getByTestId("settings-default-suggest-accept"));
    expect(screen.queryByTestId("settings-default-suggest")).toBeNull();
    await waitFor(async () => expect((await createPaymentAppPrefsRepository(fresh()).getEnabledApps())[0]).toBe("mb"));
  });

  it("dismiss is stored and the card stays hidden", async () => {
    await createAppSettingRepository(fresh()).set("pay.recent_apps", ["mb"]);
    const view = await open();
    await fireEvent.press(await screen.findByTestId("settings-default-suggest-dismiss"));
    expect(screen.queryByTestId("settings-default-suggest")).toBeNull();
    await waitFor(async () =>
      expect(await createHandOffMemoryRepository(fresh()).getDefaultSuggestionDismissed()).toBe(true),
    );
    view.unmount();
    await open();
    expect(screen.queryByTestId("settings-default-suggest")).toBeNull();
  });
});
