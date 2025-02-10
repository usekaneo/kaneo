import { node, prettier, typescript } from 'eslint-config-imperium';

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ...typescript,
    languageOptions: {
      ...typescript.languageOptions,
      parserOptions: {
        ...typescript.languageOptions.parserOptions,
        project: './tsconfig.json',
      },
    },
  },
  {
    ...node,
    rules: {
      'no-process-env': 'off',
    },
  },
  prettier,
];
