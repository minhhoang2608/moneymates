import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createPreferencesRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setAppLockAuth } from "@/lib/appLock/auth";
import { useAppLock } from "@/stores/appLock";

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
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-set-")), "test.db");
  global.__SET_TEST_DB__ = openTestDb(file).db;
});

async function open() {
  const view = await renderRouter("./app", { initialUrl: "/settings" });
  await screen.findByTestId("screen-settings", {}, { timeout: 5000 });
  await screen.findByTestId("settings-app-row-tpbank");
  return view;
}

describe("app lock toggle", () => {
  const mockAuth = (available: boolean, result: boolean | "throw") => {
    const authenticate = jest.fn(async () => {
      if (result === "throw") throw new Error("boom");
      return result;
    });
    setAppLockAuth({ isLockAvailable: async () => available, authenticate });
    return authenticate;
  };
  const enabled = async () => createPreferencesRepository(fresh()).getAppLockEnabled();

  afterEach(() => {
    setAppLockAuth(null);
    useAppLock.setState({ enabled: false, status: "unlocked", prompting: false });
  });

  it("AC1: is off and enabled by default", async () => {
    mockAuth(true, true);
    await open();
    const sw = screen.getByTestId("settings-applock-toggle");
    expect(sw.props.value).toBe(false);
    expect(sw.props.disabled).toBeFalsy();
  });

  it("AC2: turns on after successful authentication", async () => {
    const authenticate = mockAuth(true, true);
    await open();
    await fireEvent(screen.getByTestId("settings-applock-toggle"), "valueChange", true);
    await waitFor(async () => expect(await enabled()).toBe(true));
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(useAppLock.getState().enabled).toBe(true);
    expect(screen.getByTestId("settings-applock-toggle").props.value).toBe(true);
  });

  it.each([[false], ["throw" as const]])("AC3: reverts to off when authentication is %s", async (result) => {
    const authenticate = mockAuth(true, result);
    await open();
    await fireEvent(screen.getByTestId("settings-applock-toggle"), "valueChange", true);
    await waitFor(() => expect(authenticate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("settings-applock-toggle").props.value).toBe(false));
    expect(await enabled()).toBe(false);
    expect(useAppLock.getState().enabled).toBe(false);
  });

  it("AC4: is disabled with a hint when no biometrics/passcode is set up", async () => {
    const authenticate = mockAuth(false, true);
    await open();
    await screen.findByTestId("settings-applock-unavailable");
    expect(screen.getByText("Hãy cài đặt Face ID, vân tay hoặc mật khẩu cho điện thoại trước.")).toBeTruthy();
    expect(screen.getByTestId("settings-applock-toggle").props.disabled).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("AC5: shows on when enabled and turns off without authentication", async () => {
    await createPreferencesRepository(fresh()).setAppLockEnabled(true);
    const authenticate = mockAuth(true, true);
    await open();
    await waitFor(() => expect(screen.getByTestId("settings-applock-toggle").props.value).toBe(true));
    const calls = authenticate.mock.calls.length;
    await fireEvent(screen.getByTestId("settings-applock-toggle"), "valueChange", false);
    await waitFor(async () => expect(await enabled()).toBe(false));
    expect(useAppLock.getState().enabled).toBe(false);
    expect(authenticate.mock.calls.length).toBe(calls);
    expect(screen.getByTestId("settings-applock-toggle").props.value).toBe(false);
  });
});
