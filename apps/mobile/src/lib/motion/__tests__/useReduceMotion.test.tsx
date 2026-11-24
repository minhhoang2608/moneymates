import { AccessibilityInfo } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { isE2E } from "@/e2e/isE2E";
import { MAX_DURATION, durations } from "../durations";
import { useReduceMotion } from "../useReduceMotion";

jest.mock("@/e2e/isE2E", () => ({ isE2E: jest.fn(() => false) }));

describe("useReduceMotion", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(isE2E).mockReturnValue(false);
  });

  it("is true on the first render in E2E and never touches AccessibilityInfo", async () => {
    jest.mocked(isE2E).mockReturnValue(true);
    const spy = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled");
    const { result } = await renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

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
