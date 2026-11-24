import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { vi } from "@/i18n/vi";

// expo-router/testing-library registers an empty reanimated mock on import: override it afterwards.
Object.assign(require("react-native-reanimated"), require("../../jest.reanimated-mock"));
jest.mock("@/db/client", () => {
  const { openTestDb } = jest.requireActual("@/db/testing/testDb");
  return { db: openTestDb().db };
});

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true, null],
}));

jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const originalFetch = global.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
});

describe("app smoke (mirrors .maestro/smoke.yaml)", () => {
  it("renders Tổng quan with all tab labels", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    await renderRouter("./app", { initialUrl: "/" });
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    for (const label of [vi.tabs.overview, vi.tabs.history, vi.tabs.groups, vi.tabs.profile]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId("tab-qr")).toBeTruthy();
  });

  it("each tab and the QR button open their screen", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    await renderRouter("./app", { initialUrl: "/" });
    for (const name of ["history", "groups", "profile", "overview"]) {
      await fireEvent.press(screen.getByTestId(`tab-${name}`));
      expect(screen.getByTestId(`screen-${name}`)).toBeTruthy();
    }
    await fireEvent.press(screen.getByTestId("tab-qr"));
    expect(screen.getByTestId("screen-scan")).toBeTruthy();
    expect(screen.getAllByText("Quét mã thanh toán").length).toBeGreaterThan(0);
  });

  it("app stays usable when the API is unreachable", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.test";
    const fetchMock = jest.fn(async () => {
      throw new Error("offline");
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await renderRouter("./app", { initialUrl: "/" });
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("tab-history"));
    expect(screen.getByTestId("screen-history")).toBeTruthy();
  });

  it("makes no network call when no API URL is configured", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await renderRouter("./app", { initialUrl: "/" });
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
