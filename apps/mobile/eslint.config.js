const { defineConfig, globalIgnores } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([expo, globalIgnores(["node_modules/", ".expo/", "android/", "ios/", "coverage/"])]);
