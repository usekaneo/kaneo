import { checkPublishedPackage } from "./npm-checks.mjs";

export const NOTHING_TO_CHECK =
  "No plugins are listed, so there is nothing to check on npm.";

export const REMOTE_FAILED =
  "A listed package does not meet the requirements in catalog/README.md.";

function countLabel(count) {
  return `${count} ${count === 1 ? "plugin" : "plugins"}`;
}

export function pluginCount(catalog) {
  return Array.isArray(catalog?.plugins) ? catalog.plugins.length : 0;
}

export function renderProblems(problems) {
  return [
    "catalog/index.json has problems:",
    ...problems.map((problem) => `  - ${problem}`),
    "",
    "See catalog/README.md for the entry format.",
  ];
}

export function renderValid(count) {
  return `catalog/index.json is valid (${countLabel(count)} listed)`;
}

export function packageResult(entry, view) {
  if (view.notFound) {
    return {
      package: entry.package,
      version: null,
      errors: ["not found on npm"],
      warnings: [],
    };
  }
  if (view.error) {
    return {
      package: entry.package,
      version: null,
      errors: [`npm view failed: ${view.error}`],
      warnings: [],
    };
  }
  const { version } = view.manifest;
  return {
    package: entry.package,
    version: typeof version === "string" ? version : null,
    ...checkPublishedPackage(entry, view.manifest),
  };
}

export function renderPackageResult(result) {
  const label =
    result.version === null
      ? result.package
      : `${result.package}@${result.version}`;
  if (result.errors.length === 0 && result.warnings.length === 0) {
    return [`${label}: OK`];
  }
  return [
    `${label}:`,
    ...result.errors.map((error) => `  error: ${error}`),
    ...result.warnings.map((warning) => `  warning: ${warning}`),
  ];
}

export function hasFailures(packages) {
  return packages.some((result) => result.errors.length > 0);
}

export function checkReport({ plugins, problems, packages }) {
  const report = {
    ok: problems.length === 0 && !hasFailures(packages ?? []),
    plugins,
    problems,
  };
  return packages ? { ...report, packages } : report;
}
