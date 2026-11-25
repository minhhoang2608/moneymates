import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { EntryButtons } from "../EntryButtons";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]),
}));

const original = global.fetch;
function setAi(on: boolean | "offline") {
  global.fetch = jest.fn(async () => {
    if (on === "offline") throw new Error("offline");
    return { ok: true, json: async () => ({ ai_enabled: on, ai_parse_text: on, ai_parse_bill: on }) };
  }) as unknown as typeof fetch;
}
async function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  await render(
    <QueryClientProvider client={client}>
      <EntryButtons />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
});
afterEach(() => {
  global.fetch = original;
});

describe("EntryButtons", () => {
  it("renders the three labels and navigates when AI is available", async () => {
    setAi(true);
    await renderRow();
    expect(screen.getByText("Nhập tay")).toBeTruthy();
    expect(screen.getByText("Voice")).toBeTruthy();
    expect(screen.getByText("Chụp bill")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("overview-entry-bill-hint")).toBeNull());
    await fireEvent.press(screen.getByTestId("overview-entry-manual"));
    await fireEvent.press(screen.getByTestId("overview-entry-voice"));
    await fireEvent.press(screen.getByTestId("overview-entry-bill"));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(["/transaction/new", "/voice", "/bill"]);
  });

  it("explains why Chụp bill is unavailable, re-checks on tap and does not navigate; Voice still opens", async () => {
    setAi("offline");
    await renderRow();
    await waitFor(() => expect(screen.getByTestId("overview-entry-bill-hint")).toHaveTextContent(/network/));
    expect(screen.getByTestId("overview-entry-voice-hint")).toHaveTextContent(/Chỉ dùng quy tắc offline/);
    const calls = (global.fetch as jest.Mock).mock.calls.length;
    await fireEvent.press(screen.getByTestId("overview-entry-bill"));
    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(calls));
    await fireEvent.press(screen.getByTestId("overview-entry-voice"));
    expect(mockPush).toHaveBeenCalledWith("/voice");
  });

  it("keeps labels on one line and buttons equal width", async () => {
    setAi(true);
    await renderRow();
    for (const id of ["manual", "voice", "bill"]) {
      const style = StyleSheet.flatten(screen.getByTestId(`overview-entry-${id}`).props.style);
      expect(style).toMatchObject({ flex: 1, minWidth: 0, height: 44 });
    }
    for (const label of ["Nhập tay", "Voice", "Chụp bill"]) {
      expect(screen.getByText(label).props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    }
  });
});
