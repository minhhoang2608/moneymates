import { fireEvent, render, screen } from "@testing-library/react-native";

import { EntryMenu } from "../EntryMenu";

describe("EntryMenu", () => {
  it("Nhập tay is live; Voice and Chụp bill are disabled", async () => {
    const onManual = jest.fn();
    await render(<EntryMenu visible onManual={onManual} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("entry-menu-manual"));
    expect(onManual).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Chụp bill")).toBeTruthy();
    expect(screen.getByTestId("entry-menu-voice")).toBeDisabled();
    expect(screen.getByTestId("entry-menu-bill")).toBeDisabled();
  });
});
