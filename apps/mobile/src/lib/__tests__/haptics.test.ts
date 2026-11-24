import * as Haptics from "expo-haptics";
import { haptics, setHapticsEnabled } from "../haptics";

describe("haptics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });

  it("maps helpers to expo-haptics", () => {
    haptics.light();
    haptics.selection();
    haptics.error();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
  });

  it("does nothing when disabled and works again when re-enabled", () => {
    setHapticsEnabled(false);
    haptics.light();
    haptics.selection();
    haptics.error();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    setHapticsEnabled(true);
    haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it("never throws when the native module fails", () => {
    (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("no native module");
    });
    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error("x")));
    expect(() => haptics.light()).not.toThrow();
    expect(() => haptics.selection()).not.toThrow();
  });
});
