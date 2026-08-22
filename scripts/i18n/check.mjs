import {
  defaultLocale,
  flattenLocale,
  formatKeyList,
  getValueAtKey,
  loadLocales,
  setValueAtKey,
  writeJson,
} from "./shared.mjs";

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

function pluralBase(key) {
  for (const category of PLURAL_CATEGORIES) {
    const suffix = `_${category}`;
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return null;
}

function categoriesFor(locale) {
  try {
    return new Set(
      new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
    );
  } catch {
    return new Set(["other"]);
  }
}

function pluralFamilies(referenceKeys, localeKeys) {
  const families = new Set();
  for (const key of localeKeys) {
    const base = pluralBase(key);
    if (!base) {
      continue;
    }
    const known =
      referenceKeys.has(base) ||
      PLURAL_CATEGORIES.some((category) =>
        referenceKeys.has(`${base}_${category}`),
      );
    if (known) {
      families.add(base);
    }
  }
  return families;
}

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
  const required = categoriesFor(locale.locale);
  const families = pluralFamilies(referenceKeys, localeKeys);

  const missing = new Set(
    [...referenceKeys].filter((key) => {
      if (localeKeys.has(key)) {
        return false;
      }
      const base = pluralBase(key);
      return !base || required.has(key.slice(base.length + 1));
    }),
  );

  for (const base of families) {
    const referenceForms = PLURAL_CATEGORIES.filter((category) =>
      referenceKeys.has(`${base}_${category}`),
    );
    const localeForms = PLURAL_CATEGORIES.filter((category) =>
      localeKeys.has(`${base}_${category}`),
    );
    const declaresOwnForms = localeForms.some(
      (category) => !referenceForms.includes(category),
    );

    if (!declaresOwnForms) {
      continue;
    }

    for (const category of required) {
      const key = `${base}_${category}`;
      if (!localeKeys.has(key)) {
        missing.add(key);
      }
    }
  }

  const extra = new Set(
    [...localeKeys].filter((key) => {
      if (referenceKeys.has(key)) {
        return false;
      }
      const base = pluralBase(key);
      if (!base || !families.has(base)) {
        return true;
      }
      return !required.has(key.slice(base.length + 1));
    }),
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
