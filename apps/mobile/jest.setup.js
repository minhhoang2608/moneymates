/* global jest */
// expo-crypto has no native module under Jest: back randomUUID with Node's crypto.
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
