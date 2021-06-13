/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testRegex: ".spec.tsx?$",
  testEnvironment: "node",
  clearMocks: true,
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/coverage/"
  ],
  coverageProvider: "v8",
  coverageReporters: ["text", "lcov"],
  collectCoverageFrom: ["<rootDir>/src/**.*"]
};
