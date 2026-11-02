// Jest config for pure domain tests. The jest-expo preset wires up Babel
// (ESM import/export via babel-preset-expo). Domain modules under src/domain
// are framework-free, so a node test environment is enough.
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
};
