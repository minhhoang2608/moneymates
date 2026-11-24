// Minimal JS stand-in for react-native-reanimated (its native runtime is missing under Jest).
// jest.setup.js registers it globally. expo-router's testing library replaces that mock with an
// empty object, so router tests that render animated components re-register it (after the import) with
// Object.assign(require("react-native-reanimated"), require("../../jest.reanimated-mock")).
module.exports = (() => {
  const React = require("react");
  const createAnimatedComponent = (C) => C;
  return {
    __esModule: true,
    // Lazy: requiring react-native here can re-enter this mock through a circular import.
    default: {
      get View() {
        return require("react-native").View;
      },
      createAnimatedComponent,
    },
    createAnimatedComponent,
    useSharedValue: (init) => {
      const ref = React.useRef({ value: init, get: () => ref.current.value, set: (v) => (ref.current.value = v) });
      return ref.current;
    },
    useAnimatedStyle: (fn) => fn(),
    withTiming: (to) => to,
    withRepeat: (anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    cancelAnimation: () => {},
    Easing: { linear: (t) => t, inOut: (f) => f },
  };
})();
