import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { vi } from "@/i18n/vi";

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true, null],
}));

function renderApp() {
  // Render the real app directory (root layout, tabs layout, screens).
  return renderRouter("./app", { initialUrl: "/" });
}

describe("tab bar shell", () => {
  it("AC1: opens on Tổng quan and shows all tabs plus the QR button", async () => {
    await renderApp();
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    for (const label of [vi.tabs.overview, vi.tabs.history, vi.tabs.groups, vi.tabs.profile]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText("Quét QR")).toBeTruthy();
    expect(screen.getByTestId("tab-qr")).toBeTruthy();
  });

  it("AC2: navigates between tabs and to the QR screen", async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId("tab-history"));
    expect(screen.getByTestId("screen-history")).toBeTruthy();
    expect(screen).toHavePathname("/history");

    await fireEvent.press(screen.getByTestId("tab-groups"));
    expect(screen.getByTestId("screen-groups")).toBeTruthy();
    expect(screen).toHavePathname("/groups");

    await fireEvent.press(screen.getByTestId("tab-profile"));
    expect(screen.getByTestId("screen-profile")).toBeTruthy();
    expect(screen).toHavePathname("/profile");

    await fireEvent.press(screen.getByTestId("tab-overview"));
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    expect(screen).toHavePathname("/");

    await fireEvent.press(screen.getByTestId("tab-qr"));
    expect(screen.getByTestId("screen-scan")).toBeTruthy();
    expect(screen).toHavePathname("/scan");
  });

  it("AC5: works with no network access", async () => {
    const fetchMock = jest.fn(() => {
      throw new Error("network disabled");
    });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await renderApp();
      await fireEvent.press(screen.getByTestId("tab-history"));
      expect(screen.getByTestId("screen-history")).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});
