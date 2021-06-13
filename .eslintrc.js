module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"]
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:jest/recommended",
    "plugin:jest/style",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  env: {
    node: true
  },
  rules: {
    "@typescript-eslint/dot-notation": "error",
    "@typescript-eslint/method-signature-style": "error",
    "@typescript-eslint/no-base-to-string": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/promise-function-async": "error",
    "default-case": "error",
    eqeqeq: "error",
    "import/no-default-export": "error",
    "no-var": "error",
    "prefer-const": "error"
  }
};
