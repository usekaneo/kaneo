import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "../..");
export const i18nDir = path.join(repoRoot, "i18n");
export const defaultLocale = "en-US";
export const schemaPath = path.join(i18nDir, "schema.json");

export async function getLocaleFiles() {
  const entries = await fs.readdir(i18nDir, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        entry.name !== path.basename(schemaPath),
    )
    .map((entry) => ({
      locale: entry.name.replace(/\.json$/u, ""),
      path: path.join(i18nDir, entry.name),
    }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, "\t")}\n`);
}

export async function loadLocales() {
  const localeFiles = await getLocaleFiles();
  const locales = await Promise.all(
    localeFiles.map(async ({ locale, path: filePath }) => ({
      locale,
      path: filePath,
      data: await readJson(filePath),
    })),
  );

  const reference = locales.find(({ locale }) => locale === defaultLocale);

  if (!reference) {
    throw new Error(`Missing reference locale: ${defaultLocale}.json`);
  }

  return { locales, reference };
}

export function flattenLocale(localeData) {
  const keys = new Set();

  for (const [namespace, value] of Object.entries(localeData)) {
    collectKeys(value, `${namespace}:`, keys);
  }

  return keys;
}

function collectKeys(value, prefix, keys) {
  if (typeof value === "string") {
    keys.add(prefix.slice(0, -1));
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    keys.add(prefix.slice(0, -1));
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    collectKeys(childValue, `${prefix}${childKey}.`, keys);
  }
}

export function getValueAtKey(localeData, translationKey) {
  const [namespace, nestedPath] = translationKey.split(":");
  const segments = nestedPath.split(".");
  let current = localeData[namespace];

  for (const segment of segments) {
    current = current?.[segment];
  }

  return current;
}

export function setValueAtKey(localeData, translationKey, value) {
  const [namespace, nestedPath] = translationKey.split(":");
  const segments = nestedPath.split(".");
  let current = localeData[namespace];

  if (!current || typeof current !== "object" || Array.isArray(current)) {
    current = {};
    localeData[namespace] = current;
  }

  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment];
  }

  current[segments.at(-1)] = value;
}

export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

// A locale supplies the plural categories its own language needs, so _few and
// _many have no en-US counterpart. Pruning purely against the reference key set
// would delete them.
function isAllowedKey(key, allowedKeys, referenceData) {
  if (allowedKeys.has(key)) {
    return true;
  }

  for (const category of PLURAL_CATEGORIES) {
    const suffix = `_${category}`;
    if (!key.endsWith(suffix)) {
      continue;
    }

    const base = key.slice(0, -suffix.length);

    // A reference family the locale extends with its own categories.
    if (
      PLURAL_CATEGORIES.some((other) => allowedKeys.has(`${base}_${other}`))
    ) {
      return true;
    }

    // A plain reference key may only gain plural forms if it interpolates a
    // count; otherwise the suffix is a typo and should be pruned.
    if (allowedKeys.has(base) && isCountBearing(referenceData, base)) {
      return true;
    }
  }

  return false;
}

function isCountBearing(referenceData, key) {
  if (!referenceData) {
    return false;
  }
  const value = getValueAtKey(referenceData, key);
  return typeof value === "string" && value.includes("{{count}}");
}

export function pruneLocale(localeData, allowedKeys, referenceData) {
  const nextLocale = {};

  for (const [namespace, value] of Object.entries(localeData)) {
    const nextValue = pruneNamespace(
      value,
      `${namespace}:`,
      allowedKeys,
      referenceData,
    );
    if (nextValue !== undefined) {
      nextLocale[namespace] = nextValue;
    }
  }

  return nextLocale;
}

function pruneNamespace(value, prefix, allowedKeys, referenceData) {
  if (typeof value === "string") {
    return isAllowedKey(prefix.slice(0, -1), allowedKeys, referenceData)
      ? value
      : undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return isAllowedKey(prefix.slice(0, -1), allowedKeys, referenceData)
      ? value
      : undefined;
  }

  const nextValue = {};

  for (const [childKey, childValue] of Object.entries(value)) {
    const pruned = pruneNamespace(
      childValue,
      `${prefix}${childKey}.`,
      allowedKeys,
      referenceData,
    );
    if (pruned !== undefined) {
      nextValue[childKey] = pruned;
    }
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

export function formatKeyList(keys) {
  return [...keys].sort((a, b) => a.localeCompare(b));
}
