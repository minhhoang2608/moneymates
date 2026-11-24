import { AccessibilityInfo } from "react-native";
import * as reanimated from "react-native-reanimated";
import { render, screen, waitFor } from "@testing-library/react-native";

import { MAX_DURATION } from "@/lib/motion";
import { ScanFrame } from "../ScanFrame";

const mocked = reanimated as unknown as Record<string, jest.Mock | ((...a: unknown[]) => unknown)>;

function spy(name: string) {
  const original = mocked[name] as (...a: unknown[]) => unknown;
  return jest
    .spyOn(mocked, name as never)
    .mockImplementation(((...a: unknown[]) => original(...a)) as never) as jest.SpyInstance;
}

describe("ScanFrame", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the scanning animation while nothing is detected", async () => {
    const repeat = spy("withRepeat");
    await render(<ScanFrame />);
    expect(screen.getByTestId("scan-frame-animated")).toBeTruthy();
    expect(screen.getByTestId("scan-line")).toBeTruthy();
    expect(repeat).toHaveBeenCalledWith(expect.anything(), -1, true);
    expect(screen.queryByTestId("scan-flash")).toBeNull();
  });

  it("shows a flash of at most 250 ms on detection and stops the sweep", async () => {
    const timing = spy("withTiming");
    const sequence = spy("withSequence");
    const cancel = spy("cancelAnimation");
    const { rerender } = await render(<ScanFrame />);
    timing.mockClear();
    await rerender(<ScanFrame detected />);
    expect(screen.getByTestId("scan-flash")).toBeTruthy();
    expect(screen.getByTestId("scan-frame-static")).toBeTruthy();
    expect(sequence).toHaveBeenCalledTimes(1);
    const total = timing.mock.calls.reduce((sum, c) => sum + (c[1] as { duration: number }).duration, 0);
    expect(total).toBeLessThanOrEqual(MAX_DURATION);
    expect(cancel).toHaveBeenCalled();
  });

  it("reduce motion: static frame and instant flash", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const repeat = spy("withRepeat");
    const sequence = spy("withSequence");
    const { rerender } = await render(<ScanFrame />);
    await waitFor(() => expect(screen.getByTestId("scan-frame-static")).toBeTruthy());
    repeat.mockClear();
    const timing = spy("withTiming");
    await rerender(<ScanFrame detected />);
    expect(screen.getByTestId("scan-flash")).toBeTruthy();
    expect(repeat).not.toHaveBeenCalled();
    expect(sequence).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it("stops the loop on unmount", async () => {
    const cancel = spy("cancelAnimation");
    const { unmount } = await render(<ScanFrame />);
    cancel.mockClear();
    await unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
