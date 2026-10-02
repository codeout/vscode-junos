import { fileURLToPath } from "node:url";

import { includeIgnoreFile } from "@eslint/config-helpers";
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tsEslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig(
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  {
    ignores: ["server/src/junos.js"],
  },

  {
    languageOptions: {
      globals: globals.node,
    },
  },

  eslint.configs.recommended,
  {
    rules: {
      "no-restricted-syntax": ["error", "IfStatement > :not(BlockStatement).consequent"],
      "object-shorthand": ["error", "properties"],
    },
  },

  tsEslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },

  prettierRecommended,

  unicorn.configs["flat/recommended"],
  {
    rules: {
      "unicorn/consistent-boolean-name": "off",
      "unicorn/consistent-class-member-order": "off",
      "unicorn/filename-case": "off", // runTest.ts follows the lsp-sample
      "unicorn/import-style": "off",
      "unicorn/name-replacements": "off",
      "unicorn/no-computed-property-existence-check": "off", // the stores intentionally use `if (!this.store[uri])` truthiness checks
      "unicorn/prefer-await": "off",
      "unicorn/prefer-early-return": "off",
      "unicorn/prefer-simple-condition-first": "off",
      "unicorn/prefer-ternary": "off",
      "unicorn/no-null": "off", // parser.ts models absent values as null (Node.type, raw parser output)
      "unicorn/prefer-module": "off", // the extension and its config files are CommonJS (module.exports, __dirname)
      "unicorn/prefer-string-raw": "off",
    },
  },

  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
    },
  },
);
