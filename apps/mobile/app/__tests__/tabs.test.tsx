import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { StyleSheet } from "react-native";

import { FAB_CLEARANCE } from "@/components/AddFab";
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
    await waitFor(() => expect(screen.getByTestId("screen-scan")).toBeTruthy());
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

  it("#427: shows the add button on every main tab and opens the add menu", async () => {
    await renderApp();
    expect(screen.getByTestId("overview-add-button")).toBeTruthy();
    for (const [tab, id] of [
      ["tab-history", "history-add-button"],
      ["tab-groups", "groups-add-button"],
      ["tab-profile", "profile-add-button"],
    ] as const) {
      await fireEvent.press(screen.getByTestId(tab));
      await fireEvent.press(screen.getByTestId(id));
      expect(screen.getByTestId("entry-menu")).toBeTruthy();
    }
    await fireEvent.press(screen.getByTestId("entry-menu-manual"));
    expect(screen).toHavePathname("/transaction/new");
  });

  it("#427: the FAB menu opens Chụp bill (enabled) and Voice", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    try {
      await renderApp();
      await fireEvent.press(screen.getByTestId("tab-history"));
      await fireEvent.press(screen.getByTestId("history-add-button"));
      const bill = await screen.findByTestId("entry-menu-bill");
      expect(bill).not.toBeDisabled();
      await fireEvent.press(bill);
      await waitFor(() => expect(screen).toHavePathname("/bill"));
    } finally {
      delete process.env.EXPO_PUBLIC_E2E;
    }
  });

  it("#427: the FAB menu opens Voice", async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId("tab-groups"));
    await fireEvent.press(screen.getByTestId("groups-add-button"));
    await fireEvent.press(await screen.findByTestId("entry-menu-voice"));
    await waitFor(() => expect(screen).toHavePathname("/voice"));
  });

  it("#427 AC3: History, Groups and Profile lists clear the button", async () => {
    await renderApp();
    for (const [tab, list] of [
      ["tab-history", "history-list"],
      ["tab-groups", "groups-list"],
      ["tab-profile", "profile-scroll"],
    ] as const) {
      await fireEvent.press(screen.getByTestId(tab));
      const style = StyleSheet.flatten(screen.getByTestId(list).props.contentContainerStyle);
      expect(style.paddingBottom).toBeGreaterThanOrEqual(FAB_CLEARANCE);
    }
  });

  it("#427 AC4: no add button on the transaction, voice, bill and scan screens", async () => {
    for (const url of ["/transaction/new", "/voice", "/bill", "/scan"]) {
      const view = await renderRouter("./app", { initialUrl: url });
      for (const id of ["overview", "history", "groups", "profile"]) {
        expect(screen.queryByTestId(`${id}-add-button`)).toBeNull();
      }
      view.unmount();
    }
  });
});
