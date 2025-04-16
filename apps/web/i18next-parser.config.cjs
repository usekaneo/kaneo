// apps/web/i18next-parser.config.cjs

module.exports = {
  contextSeparator: "_",
  createOldCatalogs: false,
  defaultNamespace: "translation",
  defaultValue: "",
  indentation: 2,
  keepRemoved: false,
  keySeparator: ".",
  locales: ["en", "ko", "ja"],
  namespaceSeparator: ":",
  output: "src/i18n/locales/$LOCALE/$NAMESPACE.json",
  input: ["src/**/*.{ts,tsx}"],
  sort: true,
  useKeysAsDefaultValue: false,
  verbose: true,
};
