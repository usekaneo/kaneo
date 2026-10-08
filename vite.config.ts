import { defineConfig } from "vite-plus";

// Preserve the previous check scope; generated files have their own validators.
const ignorePatterns = [
  "scripts/slop-labeler/vendor/**",
  "**/node_modules/**",
  "**/coverage/**",
  "**/dist/**",
  "**/cache/**",
  "**/.cache/**",
  "**/.turbo/**",
  "**/.source/**",
  "**/.next/**",
  "**/out/**",
  "**/.claude/**",
  "**/.pi/**",
  "**/.pi-subagents/**",
  "**/.agents/**",
  "**/routeTree.gen.ts",
  "**/openapi.json",
  "**/drizzle/meta/**",
];

export default defineConfig({
  fmt: {
    printWidth: 80,
    useTabs: false,
    sortPackageJson: false,
    ignorePatterns: [
      ...ignorePatterns,
      "**/tsconfig*.json",
      "**/package.json",
      "**/*.{css,svg,html,md,mdx,yaml,yml}",
      "**/package-lock.json",
    ],
    overrides: [{ files: ["**/*.{json,jsonc}"], options: { useTabs: true } }],
  },
  lint: {
    ignorePatterns,
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
    categories: { correctness: "error" },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-param-reassign": "error",
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "typescript/prefer-as-const": "error",
      "default-param-last": "error",
      "typescript/prefer-enum-initializers": "error",
      "react/self-closing-comp": "error",
      "react/no-danger": "error",
      "react/no-array-index-key": "error",
      "no-template-curly-in-string": "error",
      "no-eval": "error",
      "unicorn/prefer-number-properties": "error",
      "typescript/no-inferrable-types": ["error", { ignoreParameters: true }],
      "no-else-return": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      // Compiler adoption and stricter accessibility/style policies are separate
      // changes. These Oxlint defaults were not enforced by the Biome baseline.
      "react/set-state-in-effect": "off",
      "react/refs": "off",
      "react/preserve-manual-memoization": "off",
      "react/incompatible-library": "off",
      "react/purity": "off",
      "react/use-memo": "off",
      "jsx-a11y/control-has-associated-label": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/prefer-tag-over-role": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-invalid-fetch-options": "off",
      "unicorn/no-useless-spread": "off",
    },
    // Package typechecks cover both web tsconfigs and emitted declarations.
    options: { typeAware: false, typeCheck: false },
    overrides: [
      {
        files: ["release.config.js", "scripts/release/*.mjs"],
        rules: { "no-template-curly-in-string": "off" },
      },
    ],
  },
  test: {
    maxWorkers: 4,
    projects: [
      "apps/api/vitest.config.ts",
      "apps/web/vitest.config.ts",
      "packages/*/vitest.config.ts",
    ],
  },
});
