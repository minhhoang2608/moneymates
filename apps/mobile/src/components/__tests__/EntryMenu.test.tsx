import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { EntryMenu } from "../EntryMenu";

const original = global.fetch;

function setAi(on: boolean | "offline" | "http-error") {
  global.fetch = jest.fn(async () => {
    if (on === "offline") throw new Error("offline");
    if (on === "http-error") return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ ai_enabled: on, ai_parse_text: on, ai_parse_bill: on }) };
  }) as unknown as typeof fetch;
}

async function renderMenu(props: Partial<React.ComponentProps<typeof EntryMenu>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  await render(
    <QueryClientProvider client={client}>
      <EntryMenu visible onManual={jest.fn()} onClose={jest.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
});
afterEach(() => {
  global.fetch = original;
});

describe("EntryMenu", () => {
  it("Nhập tay is live; Voice and Chụp bill are disabled without handlers", async () => {
    setAi(true);
    const onManual = jest.fn();
    await renderMenu({ onManual });
    await fireEvent.press(screen.getByTestId("entry-menu-manual"));
    expect(onManual).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Chụp bill")).toBeTruthy();
    expect(screen.getByTestId("entry-menu-voice")).toBeDisabled();
    expect(screen.getByTestId("entry-menu-bill")).toBeDisabled();
  });

  it("Voice stays enabled offline with a hint; Chụp bill is disabled when AI is unavailable", async () => {
    setAi("offline");
    await renderMenu({ onVoice: jest.fn(), onBill: jest.fn() });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("entry-menu-voice")).not.toBeDisabled();
    expect(screen.getByText("Chỉ dùng quy tắc offline")).toBeTruthy();
    expect(screen.getByTestId("entry-menu-bill")).toBeDisabled();
  });

  it("enabled when AI is available and a handler is given", async () => {
    setAi(true);
    const onVoice = jest.fn();
    await renderMenu({ onVoice, onBill: jest.fn() });
    await waitFor(() => expect(screen.getByTestId("entry-menu-voice")).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId("entry-menu-voice"));
    expect(onVoice).toHaveBeenCalledTimes(1);
  });
});

describe("Nhập tay with AI unavailable", () => {
  it.each([false, "offline", "http-error"] as const)("still calls onManual (AI %s)", async (mode) => {
    setAi(mode);
    const onManual = jest.fn();
    await renderMenu({ onManual, onVoice: jest.fn(), onBill: jest.fn() });
    await waitFor(() => expect(screen.getByTestId("entry-menu-bill")).toBeDisabled());
    expect(screen.getByTestId("entry-menu-manual")).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId("entry-menu-manual"));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it("still calls onManual while /me/features never resolves", async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const onManual = jest.fn();
    await renderMenu({ onManual, onVoice: jest.fn(), onBill: jest.fn() });
    await fireEvent.press(screen.getByTestId("entry-menu-manual"));
    expect(onManual).toHaveBeenCalledTimes(1);
  });
});
