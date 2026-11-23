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
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock("expo-file-system", () => {
  const join = (parts) => parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
  class File {
    constructor(...parts) {
      this.uri = join(parts);
    }
    copy() {}
  }
  class Directory {
    constructor(...parts) {
      this.uri = join(parts);
    }
    create() {}
  }
  return { File, Directory, Paths: { document: "file:///doc" } };
});
jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement(View, { ...props, testID: "datetime-picker" }) };
});

// The app database is native expo-sqlite: back it with an in-memory better-sqlite3 db under Jest.
jest.mock("@/db/client", () => ({ db: require("./src/db/testing/testDb").openTestDb().db }));
