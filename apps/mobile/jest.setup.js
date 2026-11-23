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
