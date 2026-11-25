import { fireEvent, render, screen } from "@testing-library/react-native";

import { setHapticsEnabled } from "@/lib/haptics";
import { grp, hoursAgo, NOW } from "@/lib/target/testFixtures";

import { StyleSheet } from "react-native";

import { TargetPickerSheet, targetSheetMaxHeight } from "../TargetPickerSheet";

const groups = [
  grp("dalat", "Đà Lạt 12/2026"),
  grp("antrua", "Ăn trưa văn phòng"),
  grp("phuquoc", "Phú Quốc 08/2026", { end_date: "2026-08-17" }),
];
const lastUsedByGroup = new Map([
  ["dalat", hoursAgo(2)],
  ["antrua", hoursAgo(72)],
]);

const setup = async (props: Partial<React.ComponentProps<typeof TargetPickerSheet>> = {}) =>
  render(
    <TargetPickerSheet
      visible
      groups={groups}
      lastUsedByGroup={lastUsedByGroup}
      now={NOW}
      selected={{ kind: "personal" }}
      onSelect={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />,
  );

describe("TargetPickerSheet", () => {
  it("lists personal, active groups by recency, then ended groups", async () => {
    await setup();
    const ids = screen.getAllByTestId(/^target-row-/).map((n) => n.props.testID);
    expect(ids).toEqual(["target-row-personal", "target-row-dalat", "target-row-antrua", "target-row-phuquoc"]);
    expect(screen.getByText("Đã kết thúc")).toBeTruthy();
    expect(screen.getByText("Kết thúc 17/08")).toBeTruthy();
    expect(screen.getByText("ghi lần cuối 2 giờ trước")).toBeTruthy();
  });

  it.each(["phú", "PHU"])("search %s keeps only the matching group", async (q) => {
    await setup();
    await fireEvent.changeText(screen.getByTestId("target-search"), q);
    const ids = screen.getAllByTestId(/^target-row-/).map((n) => n.props.testID);
    expect(ids).toEqual(["target-row-phuquoc"]);
    expect(screen.queryByText("Nhóm · dùng gần nhất trước")).toBeNull();
  });

  it("selects a row and closes via the close button", async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    await setup({ onSelect, onClose });
    await fireEvent.press(screen.getByTestId("target-row-antrua"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "group", groupId: "antrua" }));
    await fireEvent.press(screen.getByTestId("target-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("TargetPickerSheet haptics", () => {
  const Haptics = jest.requireMock("expo-haptics");
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });
  afterEach(() => setHapticsEnabled(true));

  it.each(["target-row-personal", "target-row-dalat"])("AC2: selecting %s fires a selection haptic", async (id) => {
    const onSelect = jest.fn();
    await setup({ onSelect });
    await fireEvent.press(screen.getByTestId(id));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("AC4: disabled haptics stay silent", async () => {
    setHapticsEnabled(false);
    const onSelect = jest.fn();
    await setup({ onSelect });
    await fireEvent.press(screen.getByTestId("target-row-dalat"));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("caps the panel with a pixel maxHeight and lets the list shrink", async () => {
    expect(targetSheetMaxHeight(800)).toBe(640);
    await setup();
    const sheet = StyleSheet.flatten(screen.getByTestId("target-sheet").props.style);
    expect(typeof sheet.maxHeight).toBe("number");
    const list = StyleSheet.flatten(screen.getByTestId("target-list").props.style);
    expect(list).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  });

  it("renders every group row inside the list and selects one", async () => {
    const many = Array.from({ length: 15 }, (_, i) => grp(`g${i}`, `Nhóm ${i}`));
    const onSelect = jest.fn();
    await setup({ groups: many, onSelect });
    expect(screen.getAllByTestId(/^target-row-g/)).toHaveLength(15);
    fireEvent.press(screen.getByTestId("target-row-g3"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "group", groupId: "g3" }));
  });
});
