import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("manual entry flow (mirrors .maestro/manual-entry.yaml)", () => {
  it("AC1/AC6: + → Nhập tay → 50k Ăn uống → saved row on Tổng quan", async () => {
    await renderRouter("./app", { initialUrl: "/" });
    await fireEvent.press(screen.getByTestId("overview-add-button"));
    await fireEvent.press(await screen.findByTestId("entry-menu-manual"));
    expect(await screen.findByTestId("transaction-form")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await fireEvent.press(screen.getByTestId("category-row"));
    await fireEvent.press(await screen.findByTestId(`category-item-${catId("Ăn uống")}`));
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(screen.getByTestId("screen-overview")).toBeTruthy());
    expect(await screen.findByText("−50.000đ")).toBeTruthy();
    expect(screen.getByTestId("overview-recent-list")).toBeTruthy();
  });

  it("long-pressing the QR tab opens the entry menu", async () => {
    await renderRouter("./app", { initialUrl: "/" });
    await fireEvent(screen.getByTestId("tab-qr"), "longPress");
    expect(await screen.findByTestId("entry-menu-manual")).toBeTruthy();
  });
});
