import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultLocale,
  flattenLocale,
  formatKeyList,
  getValueAtKey,
  loadLocales,
  PLURAL_CATEGORIES,
  pruneLocale,
  repoRoot,
  writeJson,
} from "./shared.mjs";

const pluralForms = ["_zero", "_one", "_two", "_few", "_many", "_other"];

const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");

const { locales, reference } = await loadLocales();
const localeKeys = flattenLocale(reference.data);
const sourceFiles = await collectSourceFiles(
  path.join(repoRoot, "apps", "web", "src"),
);
const namespaces = new Set(Object.keys(reference.data));
const { staticKeys, dynamicCalls, dynamicPrefixes } = await collectUsedKeys(
  sourceFiles,
  namespaces,
);

const missing = new Set(
  [...staticKeys].filter((key) => !isRepresentedByLocaleKeys(key, localeKeys)),
);
const unused = new Set(
  [...localeKeys].filter(
    (key) =>
      !isLocaleKeyUsed(key, staticKeys) &&
      !dynamicPrefixes.some((prefix) => key.startsWith(prefix)),
  ),
);

function referenceFallback(key) {
  for (const category of PLURAL_CATEGORIES) {
    const suffix = `_${category}`;
    if (!key.endsWith(suffix)) {
      continue;
    }
    const base = key.slice(0, -suffix.length);
    for (const candidate of [`${base}_other`, base, `${base}_one`]) {
      const value = getValueAtKey(reference.data, candidate);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
}

// A value byte-identical to en-US has not been translated yet. Keys added by
// `i18n:check --fix` land here, which is the only place they surface.
const untranslated = new Map();
for (const locale of locales) {
  if (locale.locale === defaultLocale) {
    continue;
  }

  // Locale-specific plural forms (_few, _many, …) are absent from en-US, so
  // they are compared against the wording their family falls back to.
  const candidates = new Set([...localeKeys, ...flattenLocale(locale.data)]);

  const pending = [...candidates].filter((key) => {
    const target = getValueAtKey(locale.data, key);
    if (typeof target !== "string") {
      return false;
    }

    const source = getValueAtKey(reference.data, key) ?? referenceFallback(key);
    return typeof source === "string" && source === target;
  });

  if (pending.length > 0) {
    untranslated.set(locale.locale, pending);
  }
}

if (
  missing.size === 0 &&
  unused.size === 0 &&
  dynamicCalls.length === 0 &&
  untranslated.size === 0
) {
  console.log("i18n report is clean.");
} else {
  if (missing.size > 0) {
    console.log("Missing keys:");
    for (const key of formatKeyList(missing)) {
      console.log(`  - ${key}`);
    }
  }

  if (unused.size > 0) {
    console.log("Unused keys:");
    for (const key of formatKeyList(unused)) {
      console.log(`  - ${key}`);
    }
  }

  if (dynamicCalls.length > 0) {
    console.log("Dynamic keys:");
    for (const call of dynamicCalls) {
      console.log(`  - ${call}`);
    }
  }

  if (untranslated.size > 0) {
    console.log("Untranslated (still identical to en-US):");
    for (const [locale, keys] of [...untranslated].sort()) {
      console.log(`  ${locale}: ${keys.length}`);
      for (const key of formatKeyList(new Set(keys))) {
        console.log(`    - ${key}`);
      }
    }
  }
}

if (shouldFix) {
  if (unused.size === 0) {
    console.log("No unused keys to remove.");
  } else {
    const allowedKeys = new Set(
      [...localeKeys].filter((key) => !unused.has(key)),
    );

    for (const locale of locales) {
      const nextLocale = pruneLocale(locale.data, allowedKeys, reference.data);
      await writeJson(locale.path, nextLocale);
    }

    console.log(
      `Removed ${unused.size} unused key(s) from ${defaultLocale} and other locales.`,
    );
  }
}

if (missing.size > 0 || dynamicCalls.length > 0) {
  process.exit(1);
}

process.exit(0);

async function collectSourceFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      if (!/\.(ts|tsx)$/u.test(entry.name)) {
        return [];
      }

      return [fullPath];
    }),
  );

  return files.flat();
}

async function collectUsedKeys(files, knownNamespaces) {
  const staticKeys = new Set();
  const dynamicCalls = [];
  const dynamicPrefixes = [];

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");

    for (const match of source.matchAll(
      /\b(?:[\w$]+\.)?t\(\s*(['"])([^'"\\]+)\1/gu,
    )) {
      staticKeys.add(match[2]);
    }

    for (const match of source.matchAll(
      /\bi18nKey\s*=\s*(['"])([^'"\\]+)\1/gu,
    )) {
      staticKeys.add(match[2]);
    }

    // Keys are not always handed straight to t(): error-handler.ts returns them
    // as values that error-display.tsx resolves through t(variable). A real
    // namespace plus a dotted path keeps Tailwind variants, storage keys and
    // permission statements out, while still reporting an indirect key the
    // reference has not defined yet.
    for (const match of source.matchAll(
      /(['"])([a-z][\w-]*):([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)\1/gu,
    )) {
      if (knownNamespaces.has(match[2])) {
        staticKeys.add(`${match[2]}:${match[3]}`);
      }
    }

    for (const match of source.matchAll(
      /\b(?:[\w$]+\.)?t\(\s*(`[^`]*\$\{[^`]*\}`|[^'"`\s][^,\n)]*)/gu,
    )) {
      const call = match[0].trim();
      dynamicCalls.push(`${path.relative(repoRoot, file)}: ${call}`);
      const prefixMatch = call.match(/`([^`$]*)\$\{/u);
      if (prefixMatch?.[1]) {
        dynamicPrefixes.push(prefixMatch[1]);
      }
    }
  }

  return { staticKeys, dynamicCalls, dynamicPrefixes };
}

function isRepresentedByLocaleKeys(key, localeKeys) {
  if (localeKeys.has(key)) {
    return true;
  }

  return pluralForms.some((suffix) => localeKeys.has(`${key}${suffix}`));
}

function isLocaleKeyUsed(key, staticKeys) {
  if (staticKeys.has(key)) {
    return true;
  }

  const baseKey = key.replace(/_(zero|one|two|few|many|other)$/u, "");
  return baseKey !== key && staticKeys.has(baseKey);
}
