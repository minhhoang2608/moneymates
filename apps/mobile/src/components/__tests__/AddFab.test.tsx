import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, Platform } from "react-native";

import { AddFab, FAB_CLEARANCE } from "../AddFab";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../EntryMenu", () => {
  const { View, Pressable } = require("react-native");
  return {
    EntryMenu: ({ visible, onManual, onVoice, onBill }: any) =>
      visible ? (
        <View testID="entry-menu">
          <Pressable testID="m-manual" onPress={onManual} />
          <Pressable testID="m-voice" onPress={onVoice} />
          <Pressable testID="m-bill" onPress={onBill} />
        </View>
      ) : null,
  };
});

describe("AddFab", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
    mockPush.mockClear();
  });

  it("exposes a clearance bigger than the button", () => {
    expect(FAB_CLEARANCE).toBeGreaterThan(52);
  });

  it("opens the menu and routes to manual, voice and bill", async () => {
    await render(<AddFab testID="fab" />);
    for (const [id, path] of [
      ["m-manual", "/transaction/new"],
      ["m-voice", "/voice"],
      ["m-bill", "/bill"],
    ]) {
      await fireEvent.press(screen.getByTestId("fab"));
      await fireEvent.press(screen.getByTestId(id));
      expect(mockPush).toHaveBeenLastCalledWith(path);
    }
  });

  it("hides while the Android keyboard is open and returns when it closes", async () => {
    Platform.OS = "android";
    const handlers: Record<string, () => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
      handlers[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    await render(<AddFab testID="fab" />);
    expect(screen.getByTestId("fab")).toBeTruthy();
    await act(async () => handlers.keyboardDidShow());
    expect(screen.queryByTestId("fab")).toBeNull();
    await act(async () => handlers.keyboardDidHide());
    expect(screen.getByTestId("fab")).toBeTruthy();
  });
});
