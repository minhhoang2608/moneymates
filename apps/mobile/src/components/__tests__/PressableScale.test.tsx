import { AccessibilityInfo, Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PressableScale } from "../PressableScale";
import { pressOpacity } from "@/lib/motion";

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
}

describe("PressableScale", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders children, forwards props and calls onPress", async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale testID="btn" accessibilityLabel="Lưu" onPress={onPress}>
        <Text>Lưu</Text>
      </PressableScale>,
    );
    expect(screen.getByText("Lưu")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Lưu")).toBeTruthy();
  });

  it("does not press when disabled", async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale testID="btn" disabled onPress={onPress}>
        <Text>x</Text>
      </PressableScale>,
    );
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId("btn").props.accessibilityState?.disabled).toBe(true);
  });

  it("applies pressed opacity on pressIn and removes it on pressOut", async () => {
    await render(
      <PressableScale testID="btn">
        <Text>x</Text>
      </PressableScale>,
    );
    const btn = screen.getByTestId("btn");
    await fireEvent(btn, "pressIn");
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBe(pressOpacity);
    await fireEvent(btn, "pressOut");
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBe(1);
  });

  it("still handles presses with reduce motion on", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const onPress = jest.fn();
    await render(
      <PressableScale testID="btn" onPress={onPress}>
        <Text>x</Text>
      </PressableScale>,
    );
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await fireEvent(screen.getByTestId("btn"), "pressIn");
    const t = flat(screen.getByTestId("btn").props.style).transform as { scale: number }[] | undefined;
    expect(t?.every((x) => x.scale === 1) ?? true).toBe(true);
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalled();
  });
});
