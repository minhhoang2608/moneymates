module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  testMatch: ["<rootDir>/golden/run.golden.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
