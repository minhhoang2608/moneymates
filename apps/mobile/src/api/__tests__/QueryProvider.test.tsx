import { focusManager } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";

import { QueryProvider } from "../QueryProvider";

describe("QueryProvider", () => {
  it("maps AppState to the TanStack focusManager", async () => {
    let handler: (s: string) => void = () => {};
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    const view = await render(<QueryProvider>{null}</QueryProvider>);
    await act(async () => handler("background"));
    expect(focusManager.isFocused()).toBe(false);
    await act(async () => handler("active"));
    expect(focusManager.isFocused()).toBe(true);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
