// Jest configuration.
// The backend uses native ES modules, so Jest must run with
// `node --experimental-vm-modules` (the npm scripts do this) and without Babel.
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/backend/tests"],
  testMatch: ["**/*.test.js"],
  transform: {}, // no Babel: the code is already native ES modules
  testTimeout: 30000, // the first import of the app can take a few seconds
  restoreMocks: true, // spies are restored automatically after every test
}
