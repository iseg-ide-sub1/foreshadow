import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
  },
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/naming-convention": ["warn", {
        selector: "import",
        format: ["camelCase", "PascalCase"],
      }],
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "off",
    },
  },
  {
    files: ["src/foundation/**/*.ts", "src/context/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "vscode",
            message: "L2 foundation and L3 context must not import vscode. Use ports/domain types instead.",
          },
        ],
        patterns: [
          {
            group: ["**/vscode", "vscode/*"],
            message: "L2 foundation and L3 context must not import vscode.",
          },
        ],
      }],
    },
  },
];
