import { render, screen } from "@testing-library/react-native";

import { buildQrImageContent } from "@/lib/share/qrTemplate";
import { generateVietQr } from "@/lib/vietqr";

import { QrImageTemplate } from "../QrImageTemplate";

// Host-render the SVG primitives so text is queryable.
jest.mock("react-native-svg", () => {
  const { Text, View } = require("react-native");
  const box = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  const text = ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>;
  return {
    __esModule: true,
    default: box,
    Circle: box,
    ClipPath: box,
    Defs: box,
    G: box,
    Rect: box,
    Text: text,
    TSpan: text,
  };
});

const base = { name: "QUAN PHO HOA", bankBin: "970423", account: "0123456789", amount: 55000 };

describe("QrImageTemplate", () => {
  it("renders every text of the template", async () => {
    await render(<QrImageTemplate {...base} message="PHO HOA BAN 12" />);
    for (const t of [
      "QUAN PHO HOA",
      "TPBank · 0123 4567 89",
      "55.000đ",
      "PHO HOA BAN 12",
      "Ảnh tạm của MoneyMates · tự xoá sau khi dùng",
    ]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });
  it("draws no logo wordmark", async () => {
    await render(<QrImageTemplate {...base} />);
    expect(screen.queryByText("Money")).toBeNull();
    expect(screen.queryByText("Mates")).toBeNull();
  });
  it("omits the temporary footer when temporary is false", async () => {
    await render(<QrImageTemplate {...base} temporary={false} />);
    expect(screen.queryByText(/Ảnh tạm/)).toBeNull();
    expect(screen.queryByText(/tự xoá/)).toBeNull();
    expect(screen.getByText("55.000đ")).toBeTruthy();
  });
  it("renders no message line without a message", async () => {
    await render(<QrImageTemplate {...base} />);
    expect(screen.queryByText("PHO HOA BAN 12")).toBeNull();
    expect(screen.getByText("55.000đ")).toBeTruthy();
  });

  describe("never throws into render", () => {
    const fallbackPayload = generateVietQr({ bankBin: "970423", account: "0123456789", amount: 12000 });
    it.each([
      ["a message over 99 characters", { amount: 55000, message: "x".repeat(120) }],
      ["amount 0", { amount: 0 }],
      ["undefined amount", { amount: undefined }],
      ["an invalid account", { account: "bad account!" }],
    ])("renders with %s", async (_n, extra) => {
      await render(<QrImageTemplate {...base} {...extra} fallbackPayload={fallbackPayload} />);
      expect(screen.getByText(/TPBank/)).toBeTruthy();
    });
    it("uses the fallback payload and hides an invalid amount", () => {
      const c = buildQrImageContent({ ...base, amount: 0, fallbackPayload });
      expect(c.payload).toBe(fallbackPayload);
      expect(c.amountLine).toBeNull();
      expect(buildQrImageContent({ ...base, account: "bad account!", fallbackPayload }).payload).toBe(fallbackPayload);
    });
    it("keeps a valid VietQR for an over-long message (it is truncated)", () => {
      const c = buildQrImageContent({ ...base, message: "x".repeat(120), fallbackPayload });
      expect(c.payload).not.toBe(fallbackPayload);
    });
  });
});
