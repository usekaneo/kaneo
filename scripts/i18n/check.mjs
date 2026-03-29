import {
  defaultLocale,
  flattenLocale,
  formatKeyList,
  getValueAtKey,
  loadLocales,
  setValueAtKey,
  writeJson,
} from "./shared.mjs";

const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const localeFilter = args.find((arg) => arg !== "--fix");

const { locales, reference } = await loadLocales();
const referenceKeys = flattenLocale(reference.data);
const targetLocales = locales.filter(({ locale }) => locale !== defaultLocale);
const filteredLocales = localeFilter
  ? targetLocales.filter(({ locale }) => locale === localeFilter)
  : targetLocales;

if (localeFilter && filteredLocales.length === 0) {
  console.error(`No locale found for "${localeFilter}".`);
  process.exit(1);
}

let hasIssues = false;

for (const locale of filteredLocales) {
  const localeKeys = flattenLocale(locale.data);
  const missing = new Set(
    [...referenceKeys].filter((key) => !localeKeys.has(key)),
  );
  const extra = new Set(
    [...localeKeys].filter((key) => !referenceKeys.has(key)),
  );

  if (missing.size === 0 && extra.size === 0) {
    console.log(`${locale.locale}: OK`);
    continue;
  }

  hasIssues = true;
  console.log(`${locale.locale}:`);

  if (missing.size > 0) {
    console.log("  Missing keys:");
    for (const key of formatKeyList(missing)) {
      console.log(`    - ${key}`);
      if (shouldFix) {
        setValueAtKey(locale.data, key, getValueAtKey(reference.data, key));
      }
    }
  }

  if (extra.size > 0) {
    console.log("  Extra keys:");
    for (const key of formatKeyList(extra)) {
      console.log(`    - ${key}`);
    }
  }

  if (shouldFix && missing.size > 0) {
    await writeJson(locale.path, locale.data);
    console.log("  Added missing keys from en-US.");
  }
}

if (!hasIssues) {
  console.log("All locale files are in sync with en-US.");
  process.exit(0);
}

process.exit(shouldFix ? 0 : 1);
