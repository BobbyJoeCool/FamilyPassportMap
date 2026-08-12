import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/generated/**",
      "apps/server/data/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // apps/server, packages/shared: Node code
  {
    files: ["apps/server/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // apps/web: React + browser code
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  prettier,
);
