import {
  defaultLocale,
  flattenLocale,
  formatKeyList,
  getValueAtKey,
  loadLocales,
  PLURAL_CATEGORIES,
  setValueAtKey,
  writeJson,
} from "./shared.mjs";

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
  let categories;
  try {
    categories = new Intl.PluralRules(locale).resolvedOptions()
      .pluralCategories;
  } catch (error) {
    throw new Error(
      `Unknown locale "${locale}": Intl.PluralRules rejected it`,
      {
        cause: error,
      },
    );
  }

  return new Set(categories);
}

function isCountBearing(referenceData, key) {
  const value = getValueAtKey(referenceData, key);
  return typeof value === "string" && value.includes("{{count}}");
}

function pluralFamilies(referenceKeys) {
  const families = new Set();
  for (const key of referenceKeys) {
    const base = pluralBase(key);
    if (base) {
      families.add(base);
    }
  }
  return families;
}

function localeValueFor(localeData, key) {
  const base = pluralBase(key);
  if (!base) {
    return undefined;
  }

  for (const candidate of [`${base}_other`, base, `${base}_one`]) {
    const value = getValueAtKey(localeData, candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function referenceValueFor(referenceData, key) {
  const direct = getValueAtKey(referenceData, key);
  if (direct !== undefined) {
    return direct;
  }

  const base = pluralBase(key);
  if (!base) {
    return undefined;
  }

  for (const candidate of [`${base}_other`, base, `${base}_one`]) {
    const value = getValueAtKey(referenceData, candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
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

const families = pluralFamilies(referenceKeys);

for (const locale of filteredLocales) {
  const localeKeys = flattenLocale(locale.data);
  const required = categoriesFor(locale.locale);
  // i18next selects _zero for an exact count of 0 even where CLDR omits it, so
  // it is accepted without being demanded.
  const allowed = new Set([...required, "zero"]);

  // A locale may pluralise a key the reference keeps singular; those forms are
  // its own, and once it has any it needs the full set for its language. This
  // is computed first because such a locale does not also need the singular.
  const localeOwnFamilies = new Set();
  for (const key of localeKeys) {
    const base = pluralBase(key);
    if (
      base &&
      referenceKeys.has(base) &&
      isCountBearing(reference.data, base)
    ) {
      localeOwnFamilies.add(base);
    }
  }

  const missing = new Set(
    [...referenceKeys].filter((key) => {
      if (localeKeys.has(key) || localeOwnFamilies.has(key)) {
        return false;
      }
      const base = pluralBase(key);
      if (!base) {
        return true;
      }
      const category = key.slice(base.length + 1);
      // _zero is an exact-count override rather than a CLDR category, so a
      // locale cannot opt out of one the reference declares.
      return category === "zero" || required.has(category);
    }),
  );

  for (const base of [...families, ...localeOwnFamilies]) {
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
      const known =
        families.has(base) ||
        (referenceKeys.has(base) && isCountBearing(reference.data, base));
      if (!base || !known) {
        return true;
      }
      return !allowed.has(key.slice(base.length + 1));
    }),
  );

  if (missing.size === 0 && extra.size === 0) {
    console.log(`${locale.locale}: OK`);
    continue;
  }

  hasIssues = true;
  console.log(`${locale.locale}:`);

  const localeSnapshot = shouldFix ? structuredClone(locale.data) : null;

  if (missing.size > 0) {
    console.log("  Missing keys:");
    for (const key of formatKeyList(missing)) {
      console.log(`    - ${key}`);
      if (shouldFix) {
        // The reference wins whenever it declares this exact category. Locale
        // wording is only synthesised for a category the reference lacks, and
        // is read from the pre-fix snapshot so a key inserted earlier in this
        // loop cannot become the source for a later one.
        const exact = getValueAtKey(reference.data, key);
        setValueAtKey(
          locale.data,
          key,
          exact !== undefined
            ? exact
            : (localeValueFor(localeSnapshot, key) ??
                referenceValueFor(reference.data, key)),
        );
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
    console.log(
      "  Added missing keys, using the locale's own plural wording where it had one.",
    );
  }
}

if (!hasIssues) {
  console.log("All locale files are in sync with en-US.");
  process.exit(0);
}

process.exit(shouldFix ? 0 : 1);
