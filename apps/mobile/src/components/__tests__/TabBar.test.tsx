import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { colors } from "@/theme";

import { TabBar } from "../TabBar";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const original = global.fetch;

function setFeatures(mode: boolean | "fail") {
  global.fetch = jest.fn(async () => {
    if (mode === "fail") throw new Error("offline");
    return { ok: true, json: async () => ({ ai_enabled: mode, ai_parse_text: mode, ai_parse_bill: mode }) };
  }) as unknown as typeof fetch;
}

async function renderBar() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const props = {
    state: { index: 0, routes: [{ key: "k0", name: "index" }] },
    navigateToTab: jest.fn(),
  } as unknown as React.ComponentProps<typeof TabBar>;
  await render(
    <QueryClientProvider client={client}>
      <TabBar {...props} />
    </QueryClientProvider>,
  );
  await fireEvent(screen.getByTestId("tab-qr"), "longPress");
}

beforeEach(() => {
  mockPush.mockClear();
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
});
afterEach(() => {
  global.fetch = original;
});

describe("TabBar entry menu: Chụp bill", () => {
  it("navigates to /bill when ai_parse_bill is on", async () => {
    setFeatures(true);
    await renderBar();
    await waitFor(() => expect(screen.getByTestId("entry-menu-bill")).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId("entry-menu-bill"));
    expect(mockPush).toHaveBeenCalledWith("/bill");
  });

  it("explains it is off and does not navigate when ai_parse_bill is off", async () => {
    setFeatures(false);
    await renderBar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("entry-menu-bill-hint")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("entry-menu-bill"));
    expect(mockPush).not.toHaveBeenCalledWith("/bill");
  });

  it("explains the failure and does not navigate when /me/features fails", async () => {
    setFeatures("fail");
    await renderBar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("entry-menu-bill-hint")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("entry-menu-bill"));
    expect(mockPush).not.toHaveBeenCalledWith("/bill");
  });
});

describe("TabBar layout", () => {
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

  it("top-aligns the bar like the design", async () => {
    setFeatures(true);
    await renderBar();
    const bar = flat("tab-bar");
    expect(bar).toMatchObject({
      alignItems: "flex-start",
      paddingTop: 8,
      paddingHorizontal: 8,
      height: 84,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    });
    expect(bar.paddingBottom).toBeUndefined();
  });

  it("positions QR button and tabs per the design", async () => {
    setFeatures(true);
    await renderBar();
    expect(flat("tab-qr")).toMatchObject({ marginTop: -26, width: 60, height: 60, borderRadius: 30 });
    for (const id of ["tab-overview", "tab-history", "tab-groups", "tab-profile"]) {
      expect(flat(id)).toMatchObject({ width: 64, alignItems: "center", gap: 4 });
    }
  });
});
