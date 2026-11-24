import type { PermissionAdapter, PermissionKind } from "./types";

/* eslint-disable @typescript-eslint/no-require-imports */

/** Live adapter on the Expo modules. Loaded lazily so Jest and E2E never touch the native modules. */
export function createExpoPermissionAdapter(): PermissionAdapter {
  return {
    get(kind) {
      switch (kind) {
        case "camera":
          return require("expo-camera").Camera.getCameraPermissionsAsync();
        case "photos":
          // writeOnly=false: read/write access on iOS, never the add-only scope.
          return require("expo-image-picker").getMediaLibraryPermissionsAsync(false);
        case "microphone":
          return require("expo-speech-recognition").ExpoSpeechRecognitionModule.getPermissionsAsync();
      }
    },
    request(kind: PermissionKind) {
      switch (kind) {
        case "camera":
          return require("expo-camera").Camera.requestCameraPermissionsAsync();
        case "photos":
          return require("expo-image-picker").requestMediaLibraryPermissionsAsync(false);
        case "microphone":
          return require("expo-speech-recognition").ExpoSpeechRecognitionModule.requestPermissionsAsync();
      }
    },
    openSettings() {
      return require("react-native").Linking.openSettings();
    },
  };
}
