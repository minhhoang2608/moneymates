import { fireEvent, render, screen } from "@testing-library/react-native";

import { BankPicker } from "../BankPicker";
import { setHapticsEnabled } from "@/lib/haptics";
import { BANKS } from "@/lib/vietqr/banks";

const Haptics = jest.requireMock("expo-haptics");

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
});
afterEach(() => setHapticsEnabled(true));

describe("BankPicker haptics", () => {
  it("AC2: choosing a bank fires a selection haptic and calls onSelect", async () => {
    const onSelect = jest.fn();
    await render(<BankPicker visible onSelect={onSelect} onClose={() => {}} />);
    await fireEvent.press(screen.getByTestId(`bank-option-${BANKS[0].code}`));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(BANKS[0]);
  });

  it("AC4: disabled haptics stay silent", async () => {
    setHapticsEnabled(false);
    const onSelect = jest.fn();
    await render(<BankPicker visible onSelect={onSelect} onClose={() => {}} />);
    await fireEvent.press(screen.getByTestId(`bank-option-${BANKS[0].code}`));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalled();
  });
});
