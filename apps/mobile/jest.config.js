module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/fixtures/", "<rootDir>/golden/run.golden.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-native-reanimated/mock$": "<rootDir>/jest.reanimated-mock.js",
  },
};
