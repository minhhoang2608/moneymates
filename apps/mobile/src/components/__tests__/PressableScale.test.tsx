import { AccessibilityInfo, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PressableScale } from "../PressableScale";
import { pressOpacity, pressScale } from "@/lib/motion";

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
    expect(flat(screen.getByTestId("btn").props.style).transform).toEqual([{ scale: pressScale }]);
    await fireEvent(btn, "pressOut");
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBe(1);
    expect(flat(screen.getByTestId("btn").props.style).transform).toEqual([{ scale: 1 }]);
  });

  it("keeps the caller's resting opacity and multiplies the pressed opacity into it", async () => {
    await render(
      <PressableScale testID="btn" style={{ opacity: 0.4 }}>
        <Text>x</Text>
      </PressableScale>,
    );
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBe(0.4);
    await fireEvent(screen.getByTestId("btn"), "pressIn");
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBeCloseTo(0.4 * pressOpacity);
    await fireEvent(screen.getByTestId("btn"), "pressOut");
    expect(flat(screen.getByTestId("btn").props.style).opacity).toBe(0.4);
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
    await act(async () => {});
    await fireEvent(screen.getByTestId("btn"), "pressIn");
    expect(flat(screen.getByTestId("btn").props.style).transform).toEqual([{ scale: 1 }]);
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalled();
  });
});
