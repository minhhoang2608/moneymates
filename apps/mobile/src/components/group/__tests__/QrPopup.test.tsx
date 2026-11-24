import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";

import { buildPaybackQr } from "@/lib/group/paybackQr";
import { buildQrImageContent } from "@/lib/share/qrTemplate";
import { parseVietQr } from "@/lib/vietqr";
import { decodeTlv } from "@/lib/vietqr/tlv";

import { QrPopup } from "../QrPopup";

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const box = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  const text = ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>;
  const Svg = React.forwardRef(function Svg(
    { children, testID }: { children?: React.ReactNode; testID?: string },
    ref: never,
  ) {
    React.useImperativeHandle(ref, () => ({ toDataURL: (cb: (d: string) => void) => cb("AAAA") }));
    return <View testID={testID}>{children}</View>;
  });
  return {
    __esModule: true,
    default: Svg,
    Circle: box,
    ClipPath: box,
    Defs: box,
    G: box,
    Rect: box,
    Text: text,
    TSpan: text,
  };
});
jest.mock("react-native-qrcode-svg", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});
jest.mock("@/components/AnimatedSheet", () => ({
  AnimatedSheet: ({ children }: { children: React.ReactNode }) => children,
}));
const account = {
  bank_bin: "970423",
  bank_name: "TPBank",
  account_no: "0123456789",
  account_name: "NGUYEN VAN A",
  deleted_at: null,
};
const memberQr = buildPaybackQr({ groupName: "Đà Lạt", account, memberName: "An", amount: 250000 });
const groupQr = buildPaybackQr({ groupName: "Đà Lạt", account });

function popup(mode: "member" | "group" = "member") {
  return (
    <QrPopup
      visible
      memberName="An"
      memberQr={memberQr}
      groupQr={groupQr}
      initialMode={mode}
      onClose={() => {}}
      onAddAccount={() => {}}
    />
  );
}

describe("QrPopup image", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the transfer template with holder, bank, amount and message, and no temporary footer", async () => {
    await render(popup());
    const h = { includeHiddenElements: true };
    const tpl = within(screen.getByTestId("qr-image-template", h));
    expect(tpl.getByText("NGUYEN VAN A", h)).toBeTruthy();
    expect(tpl.getByText("TPBank · 0123 4567 89", h)).toBeTruthy();
    expect(tpl.getByText("250.000đ", h)).toBeTruthy();
    expect(tpl.getByText("Da Lat An", h)).toBeTruthy();
    expect(screen.queryByText(/Ảnh tạm/, h)).toBeNull();
    expect(screen.queryByText(/tự xoá/, h)).toBeNull();
  });

  it("exported payload has the amount and message and no merchant name (tag 59)", () => {
    if (memberQr.kind !== "qr") throw new Error("expected qr");
    const c = buildQrImageContent({
      temporary: false,
      bankBin: memberQr.bankBin,
      account: memberQr.accountNo,
      amount: memberQr.amount ?? undefined,
      message: memberQr.message,
    });
    const parsed = parseVietQr(c.payload);
    expect(parsed.kind === "vietqr" && parsed.amount).toBe(250000);
    expect(parsed.kind === "vietqr" && parsed.message).toBe("Da Lat An");
    const tlv = decodeTlv(c.payload);
    expect(tlv.ok && tlv.fields.has("59")).toBe(false);
  });

  it("download saves to the gallery only; share opens the share sheet", async () => {
    await render(popup());
    await fireEvent.press(screen.getByTestId("qr-download"));
    await waitFor(() => expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalled());
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("qr-share"));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
  });

  it("group QR has no amount line", async () => {
    await render(popup("group"));
    const h = { includeHiddenElements: true };
    expect(screen.queryByText(/\d\.\d{3}đ/, h)).toBeNull();
    expect(screen.queryByText(/Ảnh tạm/, h)).toBeNull();
  });
});
