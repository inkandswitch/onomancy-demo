import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const automergeSlimImportRule = {
  meta: {
    name: "enforce-automerge-slim-import",
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        let isAutomergeProblem = false;
        if (node.source.value === "@automerge/automerge") {
          isAutomergeProblem = true;
        } else if (
          node.source.value.startsWith("@automerge/automerge/") &&
          !node.source.value.startsWith("@automerge/automerge/slim")
        ) {
          isAutomergeProblem = true;
        }
        if (isAutomergeProblem) {
          context.report({
            node,
            message:
              "Import from @automerge/automerge/slim instead of @automerge/automerge",
          });
        }

        let isAutomergeRepoProblem = false;
        if (node.source.value === "@automerge/automerge-repo") {
          isAutomergeRepoProblem = true;
        } else if (
          node.source.value.startsWith("@automerge/automerge-repo/") &&
          !node.source.value.startsWith("@automerge/automerge-repo/slim")
        ) {
          isAutomergeRepoProblem = true;
        }
        if (isAutomergeRepoProblem) {
          context.report({
            node,
            message:
              "Import from @automerge/automerge-repo/slim instead of @automerge/automerge-repo",
          });
        }
      },
    };
  },
};

export default [
  {
    ignores: [
      "**/*.d.ts",
      "**/*.config.ts",
      "**/*.config.js",
      "**/dist/*",
      "**/node_modules/*",
      "eslint.config.mjs",
    ],
  },
  js.configs.recommended,
  ...compat.extends(
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "packages/*/src/**/*.ts",
      "packages/*/src/**/*.tsx",
    ],

    plugins: {
      "@typescript-eslint": typescriptEslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "automerge-slimport": {
        rules: {
          "enforce-automerge-slim-import": automergeSlimImportRule,
        },
      },
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        project: [
          "./tsconfig.json",
          "./tsconfig.node.json",
          "./packages/keyhive-react/tsconfig.json",
        ],
      },
    },

    rules: {
      "@typescript-eslint/no-floating-promises": 2,
      "@typescript-eslint/no-empty-function": 0,
      "@typescript-eslint/no-non-null-assertion": 0,
      "@typescript-eslint/no-explicit-any": 0,

      "@typescript-eslint/no-unused-vars": [
        2,
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "automerge-slimport/enforce-automerge-slim-import": 2,

      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        1,
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs"],

    plugins: {
      "automerge-slimport": {
        rules: {
          "enforce-automerge-slim-import": automergeSlimImportRule,
        },
      },
    },

    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: "latest",
      sourceType: "module",
    },

    rules: {
      "automerge-slimport/enforce-automerge-slim-import": 2,
    },
  },
];
