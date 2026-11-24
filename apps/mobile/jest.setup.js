/* global jest */
// expo-crypto has no native module under Jest: back randomUUID with Node's crypto.
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

// expo-camera has no native module under Jest. Tests control permission and decoding through globals.
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const state = { permission: { granted: true, canAskAgain: true }, lastProps: null };
  return {
    __state: state,
    CameraView: (props) => {
      state.lastProps = props;
      return React.createElement(View, { testID: "camera-view" });
    },
    useCameraPermissions: () => [state.permission, jest.fn()],
    scanFromURLAsync: jest.fn(async () => []),
  };
});

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(async (uri) => ({ uri: `${uri}#compressed`, width: 1, height: 1 })),
}));
jest.mock("expo-file-system", () => {
  const join = (parts) => parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
  class File {
    constructor(...parts) {
      this.uri = join(parts);
    }
    copy() {}
    create() {}
    write() {}
  }
  class Directory {
    constructor(...parts) {
      this.uri = join(parts);
    }
    create() {}
  }
  return { File, Directory, Paths: { document: "file:///doc", cache: "file:///cache" } };
});
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
jest.mock("react-native-qrcode-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ getRef, value }) => {
      if (getRef) getRef({ toDataURL: (cb) => cb("BASE64PNG") });
      return React.createElement(View, { testID: "qr-svg", value });
    },
  };
});
jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement(View, { ...props, testID: "datetime-picker" }) };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
// Reanimated needs its native runtime: a JS stand-in (jest.reanimated-mock.js). expo-router's testing library
// installs its own mock that loads "react-native-reanimated/mock", which jest.config.js maps to the same stand-in.
jest.mock("react-native-reanimated", () => require("./jest.reanimated-mock"));
jest.mock("react-native-reanimated/mock", () => require("./jest.reanimated-mock"));

// The app database is native expo-sqlite: back it with an in-memory better-sqlite3 db under Jest.
jest.mock("@/db/client", () => ({ db: require("./src/db/testing/testDb").openTestDb().db }));

// Local Android-only native module has no native side under Jest.
jest.mock("./modules/bank-hand-off", () => ({
  openIntentUri: jest.fn(async () => {}),
  sharePng: jest.fn(async () => {}),
}));
