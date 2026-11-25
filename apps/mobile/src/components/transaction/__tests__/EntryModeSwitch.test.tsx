import { fireEvent, render } from "@testing-library/react-native";

import { EntryModeSwitch } from "../EntryModeSwitch";

describe("EntryModeSwitch", () => {
  it("selects Nhập tay and fires the callbacks", async () => {
    const onVoice = jest.fn();
    const onBill = jest.fn();
    const view = await render(<EntryModeSwitch onVoice={onVoice} onBill={onBill} />);
    expect(view.getByTestId("entry-mode-manual").props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId("entry-mode-voice").props.accessibilityState).toEqual({ selected: false });
    await fireEvent.press(view.getByTestId("entry-mode-voice"));
    await fireEvent.press(view.getByTestId("entry-mode-bill"));
    expect(onVoice).toHaveBeenCalledTimes(1);
    expect(onBill).toHaveBeenCalledTimes(1);
  });
});
