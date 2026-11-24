import { fireEvent, render, screen } from "@testing-library/react-native";

import { SheetPicker } from "../SheetPicker";
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
