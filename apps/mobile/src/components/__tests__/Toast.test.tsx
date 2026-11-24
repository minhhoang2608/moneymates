import { act, render, screen } from "@testing-library/react-native";

import { useToast } from "@/stores/toast";

import { TOAST_MS, Toast } from "../Toast";

describe("Toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => useToast.getState().hide());
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
});
