import { render, screen } from "@testing-library/react-native";

import type { PayConfirmModel } from "@/lib/payConfirm/params";

import { HandOffQr } from "../HandOffQr";

const mockTemplate = jest.fn();
jest.mock("@/components/share/QrImageTemplate", () => ({
  QrImageTemplate: (props: unknown) => {
    mockTemplate(props);
    return null;
  },
}));

const model: PayConfirmModel = {
  kind: "vietqr",
  bankName: "TPBank",
  bankBin: "970423",
  account: "0123456789",
  name: "QUAN PHO HOA",
  isDynamic: false,
  payload: "000201",
};

describe("HandOffQr", () => {
  beforeEach(() => mockTemplate.mockClear());

  it("renders the QR-only template with the confirmed amount and note", async () => {
    const getRef = jest.fn();
    await render(<HandOffQr model={model} amount={55000} note="PHO HOA BAN 12" getRef={getRef} />);
    expect(mockTemplate).toHaveBeenCalledTimes(1);
    const props = mockTemplate.mock.calls[0][0];
    expect(props).toMatchObject({
      qrOnly: true,
      amount: 55000,
      message: "PHO HOA BAN 12",
      bankBin: "970423",
      account: "0123456789",
      getRef,
    });
    expect(screen.toJSON()).not.toBeNull();
  });

  it("shows no text of its own", async () => {
    await render(<HandOffQr model={model} amount={55000} note="PHO HOA BAN 12" getRef={jest.fn()} />);
    expect(screen.queryByText(/./)).toBeNull();
  });
});
