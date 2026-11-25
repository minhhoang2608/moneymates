import { fireEvent, render, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import { SheetPicker, sheetMaxHeight } from "../SheetPicker";
import { setHapticsEnabled } from "@/lib/haptics";

const Haptics = jest.requireMock("expo-haptics");
const options = [{ key: "a", label: "Alpha", testID: "opt-a" }];

async function renderPicker(onSelect: (k: string) => void) {
  await render(
    <SheetPicker visible title="T" options={options} selectedKey={null} onSelect={onSelect} onClose={() => {}} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
});
afterEach(() => setHapticsEnabled(true));

describe("SheetPicker haptics", () => {
  it("AC2: selecting an option fires a selection haptic and calls onSelect", async () => {
    const onSelect = jest.fn();
    await renderPicker(onSelect);
    await fireEvent.press(screen.getByTestId("opt-a"));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("AC4: disabled haptics stay silent but selection still works", async () => {
    setHapticsEnabled(false);
    const onSelect = jest.fn();
    await renderPicker(onSelect);
    await fireEvent.press(screen.getByTestId("opt-a"));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});

function modalOf(testID: string) {
  let node = screen.getByTestId(testID).parent;
  while (node && !("onRequestClose" in node.props)) node = node.parent;
  return node!;
}

describe("SheetPicker docking", () => {
  it("sheetMaxHeight is 60% of the window in pixels", () => {
    expect(sheetMaxHeight(800)).toBe(480);
  });

  it("panel uses a numeric maxHeight, list does not grow, layer docks to the bottom", async () => {
    await renderPicker(() => {});
    const panel = StyleSheet.flatten(screen.getByTestId("sheet-picker-panel").props.style);
    expect(typeof panel.maxHeight).toBe("number");
    expect(panel.maxHeight).toBe(sheetMaxHeight(Dimensions.get("window").height));
    const layer = StyleSheet.flatten(screen.getByTestId("sheet-picker-layer").props.style);
    expect(layer).toMatchObject({ flex: 1, justifyContent: "flex-end" });
  });
});

describe("SheetPicker docking", () => {
  it("AC1: list does not grow, and the panel sits inside the bottom-aligned layer", async () => {
    await renderPicker(() => {});
    expect(StyleSheet.flatten(screen.getByTestId("sheet-picker-list").props.style).flexGrow).toBe(0);
    const panel = StyleSheet.flatten(screen.getByTestId("sheet-picker-panel").props.style);
    expect(typeof panel.maxHeight).toBe("number");
    const layer = screen.getByTestId("sheet-picker-layer");
    expect(StyleSheet.flatten(layer.props.style).justifyContent).toBe("flex-end");
    expect(layer).toContainElement(screen.getByTestId("sheet-picker-panel"));
  });

  it("AC1: the modal is transparent and translucent under both bars", async () => {
    await renderPicker(() => {});
    const modal = modalOf("sheet-picker-layer");
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
  });
});
