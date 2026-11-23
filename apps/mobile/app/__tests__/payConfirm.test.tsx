import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import qr from "../../e2e/fixtures/qr.json";
import { handOff } from "@/lib/payConfirm/handOff";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/payConfirm/handOff", () => ({ handOff: jest.fn(async () => {}) }));

const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
const original = global.fetch;
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

describe("pay-confirm screen", () => {
  beforeEach(() => jest.mocked(handOff).mockClear());

  it("AC1: dynamic code is prefilled", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    expect(await screen.findByText("NGUYEN VAN A")).toBeTruthy();
    expect(screen.getByText("TPBank · 0123456789")).toBeTruthy();
    expect(screen.getByTestId("pay-amount").props.value).toBe("55000");
    expect(screen.getByTestId("pay-note").props.value).toBe("PHO 24");
    expect(screen.getByText("Thanh toán 55.000đ qua TPBank")).toBeTruthy();
  });

  it.each([
    ["static", qr.static],
    ["merchant", qr.merchant],
  ])("AC2/AC4: %s code starts empty and disabled until an amount is typed", async (_n, text) => {
    await renderRouter("./app", { initialUrl: urlFor(text) });
    const amount = await screen.findByTestId("pay-amount");
    expect(amount.props.value).toBe("");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(amount, "55000");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(false);
  });

  it("AC3/AC5: submit saves one qr expense, then hands off; chosen app is remembered", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("app-mb"));
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1));
    expect(jest.mocked(handOff).mock.calls[0][0].id).toBe("mb");
    expect(jest.mocked(handOff).mock.calls[0][1]).toBe(qr.dynamic);
  });
});
