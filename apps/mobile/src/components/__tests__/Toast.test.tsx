import { act, render, screen } from "@testing-library/react-native";

import { isE2E } from "@/e2e/isE2E";
import { useToast } from "@/stores/toast";

import { E2E_TOAST_MS, TOAST_MS, Toast, toastDuration } from "../Toast";

jest.mock("@/e2e/isE2E", () => ({ isE2E: jest.fn(() => false) }));

describe("Toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await act(async () => useToast.getState().hide());
    jest.useRealTimers();
  });

  it("shows the text and auto-hides", async () => {
    await render(<Toast />);
    expect(screen.queryByTestId("handoff-coach-toast")).toBeNull();
    await act(async () => useToast.getState().show("Xin chào"));
    expect(screen.getByTestId("handoff-coach-toast")).toHaveTextContent("Xin chào");
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS + 10);
    });
    expect(screen.queryByTestId("handoff-coach-toast")).toBeNull();
  });

  it("keeps the toast visible for the longer duration in E2E mode", async () => {
    (isE2E as jest.Mock).mockReturnValue(true);
    try {
      expect(toastDuration()).toBe(E2E_TOAST_MS);
      await render(<Toast />);
      await act(async () => useToast.getState().show("Xin chào"));
      await act(async () => {
        jest.advanceTimersByTime(TOAST_MS + 10);
      });
      expect(screen.getByTestId("handoff-coach-toast")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(E2E_TOAST_MS - TOAST_MS);
      });
      expect(screen.queryByTestId("handoff-coach-toast")).toBeNull();
    } finally {
      (isE2E as jest.Mock).mockReturnValue(false);
    }
  });

  it("is an accessible live region", async () => {
    await render(<Toast />);
    await act(async () => useToast.getState().show("Xin chào"));
    const bar = screen.getByTestId("handoff-coach-toast");
    expect(bar.props.accessible).toBe(true);
    expect(bar.props.accessibilityLiveRegion).toBe("polite");
  });
});
