import { fireEvent, render, screen } from "@testing-library/react-native";

import type { PayApp } from "@/lib/payConfirm/apps";
import { PayAppRow } from "../PayAppRow";

const app = (over: Partial<PayApp>): PayApp => ({
  id: "tpb",
  type: "bank",
  name: "TPBank",
  short: "TP",
  deeplinkCode: "tpb",
  supportsAutofill: false,
  ...over,
});

describe("PayAppRow", () => {
  it("shows the name, the scan-image badge and the change link", async () => {
    await render(<PayAppRow app={app({})} onChange={jest.fn()} />);
    expect(screen.getByTestId("pay-app-row-name")).toHaveTextContent("TPBank");
    expect(screen.getByTestId("pay-app-row-badge")).toHaveTextContent("Quét ảnh QR");
    expect(screen.getByTestId("pay-app-change")).toHaveTextContent("Đổi ›");
  });
  it("shows Tự điền for autofill apps", async () => {
    await render(<PayAppRow app={app({ id: "mb", name: "MB Bank", supportsAutofill: true })} onChange={jest.fn()} />);
    expect(screen.getByTestId("pay-app-row-badge")).toHaveTextContent("Tự điền");
  });
  it("pressing the row calls onChange", async () => {
    const onChange = jest.fn();
    await render(<PayAppRow app={app({})} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("pay-app-row"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
