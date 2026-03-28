import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultLocale,
  flattenLocale,
  formatKeyList,
  loadLocales,
  pruneLocale,
  repoRoot,
  writeJson,
} from "./shared.mjs";

const pluralForms = ["_zero", "_one", "_two", "_few", "_many", "_other"];

const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");

const { locales, reference } = await loadLocales();
const localeKeys = flattenLocale(reference.data);
const sourceFiles = await collectSourceFiles(path.join(repoRoot, "apps", "web", "src"));
const { staticKeys, dynamicCalls, dynamicPrefixes } = await collectUsedKeys(sourceFiles);

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

if (missing.size === 0 && unused.size === 0 && dynamicCalls.length === 0) {
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
}

if (shouldFix) {
  if (unused.size === 0) {
    console.log("No unused keys to remove.");
  } else {
    const allowedKeys = new Set([...localeKeys].filter((key) => !unused.has(key)));

    for (const locale of locales) {
      const nextLocale = pruneLocale(locale.data, allowedKeys);
      await writeJson(locale.path, nextLocale);
    }

    console.log(`Removed ${unused.size} unused key(s) from ${defaultLocale} and other locales.`);
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

async function collectUsedKeys(files) {
  const staticKeys = new Set();
  const dynamicCalls = [];
  const dynamicPrefixes = [];

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");

    for (const match of source.matchAll(/\b(?:[\w$]+\.)?t\(\s*(['"])([^'"\\]+)\1/gu)) {
      staticKeys.add(match[2]);
    }

    for (const match of source.matchAll(/\bi18nKey\s*=\s*(['"])([^'"\\]+)\1/gu)) {
      staticKeys.add(match[2]);
    }

    for (const match of source.matchAll(/\b(?:[\w$]+\.)?t\(\s*(`[^`]*\$\{[^`]*\}`|[^'"`\s][^,\n)]*)/gu)) {
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
