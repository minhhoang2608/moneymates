import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { useReduceMotion } from "@/lib/motion";
import { MAX_DURATION } from "@/lib/motion/durations";
import { SheetPicker } from "@/components/transaction/SheetPicker";

import { AnimatedSheet } from "../AnimatedSheet";

jest.mock("@/lib/motion/useReduceMotion", () => ({ useReduceMotion: jest.fn(() => false) }));
jest.mock("@/e2e/isE2E", () => ({ isE2E: jest.fn(() => false) }));

const reduce = jest.mocked(useReduceMotion);

function sheet(visible: boolean, onClose = () => {}) {
  return (
    <AnimatedSheet visible={visible} onClose={onClose} variant="sheet" testID="s" backdropLabel="Đóng">
      <Text>body</Text>
    </AnimatedSheet>
  );
}

beforeEach(() => {
  reduce.mockReturnValue(false);
  jest.restoreAllMocks();
});

function navBarTranslucent(): unknown {
  let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId("s-layer");
  while (node && !("navigationBarTranslucent" in node.props)) node = node.parent;
  return node?.props.navigationBarTranslucent;
}

describe("AnimatedSheet", () => {
  it("covers the nav bar for sheets but not for fullscreen", async () => {
    const { rerender } = await render(sheet(true));
    expect(navBarTranslucent()).toBe(true);
    await rerender(
      <AnimatedSheet visible onClose={() => {}} variant="fullscreen" testID="s">
        <Text>body</Text>
      </AnimatedSheet>,
    );
    expect(navBarTranslucent()).toBe(false);
  });

  it("AC1: fades the backdrop in and animates out before unmounting", async () => {
    const spy = jest.spyOn(Reanimated, "withTiming");
    const { rerender } = await render(sheet(true));
    expect(screen.getByTestId("s-backdrop")).toBeTruthy();
    expect(spy).toHaveBeenCalledWith(1, expect.objectContaining({ duration: expect.any(Number) }));
    const cfg = spy.mock.calls[0][1] as { duration: number };
    expect(cfg.duration).toBeLessThanOrEqual(MAX_DURATION);
    await rerender(sheet(false));
    expect(spy).toHaveBeenCalledWith(0, expect.anything(), expect.any(Function));
    expect(screen.queryByText("body")).toBeNull();
  });

  it("AC1: onClose fires synchronously on backdrop press", async () => {
    const onClose = jest.fn();
    await render(sheet(true, onClose));
    await fireEvent.press(screen.getByLabelText("Đóng"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("AC4: reduce motion skips withTiming and unmounts at once", async () => {
    reduce.mockReturnValue(true);
    const spy = jest.spyOn(Reanimated, "withTiming");
    const { rerender } = await render(sheet(true));
    expect(screen.getByTestId("s-backdrop").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 })]),
    );
    await rerender(sheet(false));
    expect(screen.queryByText("body")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("is used by SheetPicker", async () => {
    await render(
      <SheetPicker visible title="T" options={[]} selectedKey={null} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByTestId("sheet-picker-backdrop")).toBeTruthy();
    await act(async () => {});
  });
});
