module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/golden/run.golden.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
