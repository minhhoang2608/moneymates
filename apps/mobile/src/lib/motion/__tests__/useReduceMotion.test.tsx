import { AccessibilityInfo } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { MAX_DURATION, durations } from "../durations";
import { useReduceMotion } from "../useReduceMotion";

describe("useReduceMotion", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns the system setting and follows changes, cleaning up on unmount", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const remove = jest.fn();
    let handler: (v: boolean) => void = () => {};
    const add = jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
      _: string,
      h: (v: boolean) => void,
    ) => {
      handler = h;
      return { remove };
    }) as never);
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => handler(false));
    expect(result.current).toBe(false);
    expect(add).toHaveBeenCalledWith("reduceMotionChanged", expect.any(Function));
    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("keeps every duration within the cap", () => {
    Object.values(durations).forEach((d) => expect(d).toBeLessThanOrEqual(MAX_DURATION));
  });
});
