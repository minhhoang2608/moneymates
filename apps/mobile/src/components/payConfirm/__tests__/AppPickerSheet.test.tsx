import { fireEvent, render, screen } from "@testing-library/react-native";

import { PAY_APPS } from "@/lib/payConfirm/apps";
import { AppPickerSheet } from "../AppPickerSheet";

const TPB_BIN = "970423";

const setup = async (over: Partial<React.ComponentProps<typeof AppPickerSheet>> = {}) => {
  const props = {
    enabled: ["tpb", "mb", "tcb"],
    qrBin: TPB_BIN,
    recentIds: ["mb"],
    lastUsedId: "tpb",
    selectedId: "tpb",
    catalogue: PAY_APPS,
    onSelect: jest.fn(),
    onManage: jest.fn(),
    onClose: jest.fn(),
    ...over,
  };
  await render(<AppPickerSheet {...props} />);
  return { props };
};

describe("AppPickerSheet", () => {
  it("AC2: QR bank first with its subtitle, recent next, tick on the selected app", async () => {
    await setup();
    const ids = screen.getAllByTestId(/^app-(?!badge-|sub-)/).map((n) => n.props.testID);
    expect(ids.slice(0, 3)).toEqual(["app-tpb", "app-mb", "app-tcb"]);
    expect(screen.getByTestId("app-sub-tpb")).toHaveTextContent("Ngân hàng trong mã QR · dùng lần trước");
    expect(screen.getByTestId("app-sub-mb")).toHaveTextContent("Dùng gần đây");
    expect(screen.queryByTestId("app-sub-tcb")).toBeNull();
    expect(screen.getByTestId("app-tpb").props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId("app-mb").props.accessibilityState.selected).toBe(false);
    expect(screen.getByText("✓")).toBeTruthy();
  });
  it("omits 'dùng lần trước' when the QR bank app was not the last used", async () => {
    await setup({ lastUsedId: "mb" });
    expect(screen.getByTestId("app-sub-tpb")).toHaveTextContent(/^Ngân hàng trong mã QR$/);
  });
  it("AC2: searching finds apps that are not enabled", async () => {
    await setup();
    expect(screen.queryByTestId("app-vcb")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "vietcom");
    expect(screen.getByTestId("app-vcb")).toBeTruthy();
  });
  it("AC2: shows an empty state when nothing matches", async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "zzzz");
    expect(screen.getByTestId("pay-app-empty")).toHaveTextContent("Không tìm thấy ngân hàng");
  });
  it("AC2: pressing a row selects it", async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByTestId("app-mb"));
    expect(props.onSelect).toHaveBeenCalledWith("mb");
  });
  it("AC3: the manage link calls onManage", async () => {
    const { props } = await setup();
    await fireEvent.press(screen.getByTestId("pay-app-manage"));
    expect(props.onManage).toHaveBeenCalledTimes(1);
  });
});
