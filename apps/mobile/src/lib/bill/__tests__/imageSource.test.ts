import * as Manipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { createNativeBillImageSource } from "../imageSource";

const manipulate = Manipulator.manipulateAsync as jest.Mock;
const picker = ImagePicker as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///big.jpg", width: 4000, height: 3000 }],
  });
});

describe("native bill image source", () => {
  it("AC5: resizes to a 1600 long side and compresses to JPEG", async () => {
    const uri = await createNativeBillImageSource().capture();
    expect(manipulate).toHaveBeenCalledWith("file:///big.jpg", [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: "jpeg",
    });
    expect(uri).toBe("file:///big.jpg#compressed");
  });
  it("returns null when the camera permission is denied or the user cancels", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await createNativeBillImageSource().capture()).toBeNull();
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    expect(await createNativeBillImageSource().capture()).toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
  });
});
