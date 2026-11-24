import { render, screen } from "@testing-library/react-native";

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
      "Money",
      "Mates",
      "QUAN PHO HOA",
      "TPBank · 0123 4567 89",
      "55.000đ",
      "PHO HOA BAN 12",
      "Ảnh tạm của MoneyMates · tự xoá sau khi dùng",
    ]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });
  it("renders no message line without a message", async () => {
    await render(<QrImageTemplate {...base} />);
    expect(screen.queryByText("PHO HOA BAN 12")).toBeNull();
    expect(screen.getByText("55.000đ")).toBeTruthy();
  });
});
