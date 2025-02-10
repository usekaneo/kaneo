import {
  browser,
  node,
  prettier,
  react,
  typescript,
} from 'eslint-config-imperium';

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ...typescript,
    languageOptions: {
      ...typescript.languageOptions,
      parserOptions: {
        ...typescript.languageOptions.parserOptions,
        project: './tsconfig.app.json',
      },
    },
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
  browser,
  react,
  node,
  prettier,
];
