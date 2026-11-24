import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor, act } from "expo-router/testing-library";
import { AppState, Platform } from "react-native";

import { createPreferencesRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { isAccessGranted, openAccessSettings } from "../../modules/notification-listener";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__SET_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "9.9.9" } } }));
jest.mock("../../modules/notification-listener", () => ({
  isAccessGranted: jest.fn(async () => false),
  openAccessSettings: jest.fn(async () => undefined),
  subscribe: jest.fn(() => () => {}),
}));

declare global {
  var __SET_TEST_DB__: object;
}

let file: string;
const fresh = () => openTestDb(file).db as unknown as AnyDb;
const prefs = () => createPreferencesRepository(fresh());
const setOS = (os: string) => Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-na-")), "test.db");
  global.__SET_TEST_DB__ = openTestDb(file).db;
  (isAccessGranted as jest.Mock).mockResolvedValue(false);
  (openAccessSettings as jest.Mock).mockClear();
  setOS("android");
});
afterEach(() => {
  setOS("ios");
  jest.restoreAllMocks();
});

// On Android the RN Switch renders a host with `value`/`checked` under different props.
const isOn = (el: { props: Record<string, unknown> }) => Boolean(el.props.value ?? el.props.checked ?? el.props.on);

async function open() {
  const view = await renderRouter("./app", { initialUrl: "/settings" });
  await screen.findByTestId("screen-settings", {}, { timeout: 5000 });
  await screen.findByTestId("settings-payment-apps-row");
  return view;
}

describe("settings auto-detect switch", () => {
  it("AC1: Android shows the row, off by default; turning it on opens the explainer", async () => {
    await open();
    expect(screen.getByText("Tự nhận biết chuyển khoản")).toBeTruthy();
    expect(screen.getByText("Android · đọc thông báo app ngân hàng")).toBeTruthy();
    const sw = screen.getByTestId("settings-auto-detect-toggle");
    expect(isOn(sw)).toBe(false);
    await fireEvent(sw, "valueChange", true);
    await screen.findByTestId("screen-notif-access");
  });

  it("AC3: hidden off Android", async () => {
    setOS("ios");
    await open();
    expect(screen.queryByTestId("settings-auto-detect-toggle")).toBeNull();
  });

  it("AC4: shows on only when saved and access is granted", async () => {
    await prefs().setAutoDetectTransfers(true);
    (isAccessGranted as jest.Mock).mockResolvedValue(true);
    await open();
    await waitFor(() => expect(isOn(screen.getByTestId("settings-auto-detect-toggle"))).toBe(true));
  });

  it("AC4: revoked access writes the setting back to false", async () => {
    await prefs().setAutoDetectTransfers(true);
    await open();
    await waitFor(async () => expect(await prefs().getAutoDetectTransfers()).toBe(false));
    expect(isOn(screen.getByTestId("settings-auto-detect-toggle"))).toBe(false);
  });

  it("AC4: turning it off clears the setting", async () => {
    await prefs().setAutoDetectTransfers(true);
    (isAccessGranted as jest.Mock).mockResolvedValue(true);
    await open();
    await waitFor(() => expect(isOn(screen.getByTestId("settings-auto-detect-toggle"))).toBe(true));
    await fireEvent(screen.getByTestId("settings-auto-detect-toggle"), "valueChange", false);
    await waitFor(async () => expect(await prefs().getAutoDetectTransfers()).toBe(false));
    expect(isOn(screen.getByTestId("settings-auto-detect-toggle"))).toBe(false);
  });
});
