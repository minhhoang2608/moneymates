module.exports = {
  preset: "jest-expo",
  // The GitHub runner is slow: the Tổng quan suite takes ~25 s and single tests exceeded the 5 s default.
  testTimeout: 30000,
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/fixtures/", "<rootDir>/golden/run.golden.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-native-reanimated/mock$": "<rootDir>/jest.reanimated-mock.js",
  },
};
