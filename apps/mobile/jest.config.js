module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/golden/run.golden.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
