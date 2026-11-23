import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { SwipeableRow } from "../SwipeableRow";

describe("SwipeableRow", () => {
  it("calls onDelete when the revealed Xóa button is pressed", async () => {
    const onDelete = jest.fn();
    await render(
      <SwipeableRow id="a" onDelete={onDelete}>
        <Text>row</Text>
      </SwipeableRow>,
    );
    await fireEvent.press(screen.getByTestId("history-delete-a"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("exposes a delete accessibility action", async () => {
    const onDelete = jest.fn();
    await render(
      <SwipeableRow id="a" onDelete={onDelete}>
        <Text>row</Text>
      </SwipeableRow>,
    );
    const el = screen.getByTestId("history-delete-a").parent!;
    await fireEvent(el, "accessibilityAction", { nativeEvent: { actionName: "delete" } });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
