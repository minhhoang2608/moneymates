import * as camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { Platform } from "react-native";

import { createExpoPermissionAdapter } from "../expoAdapter";

describe("expo permission adapter", () => {
  const original = Platform.OS;
  beforeEach(() => {
    Platform.OS = "ios";
    jest.clearAllMocks();
  });
  afterEach(() => {
    Platform.OS = original;
  });

  it("photos use read/write scope on iOS, never add-only", async () => {
    const a = createExpoPermissionAdapter();
    await a.request("photos");
    await a.get("photos");
    const req = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
    const get = ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock;
    expect(req).toHaveBeenCalledWith(false);
    expect(get).toHaveBeenCalledWith(false);
    for (const call of [...req.mock.calls, ...get.mock.calls]) expect(call[0]).not.toBe(true);
  });

  it("camera uses expo-camera and microphone uses the speech module", async () => {
    const a = createExpoPermissionAdapter();
    await a.request("camera");
    await a.get("camera");
    expect((camera as any).Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect((camera as any).Camera.getCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    await a.request("microphone");
    await a.get("microphone");
    expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ExpoSpeechRecognitionModule.getPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
