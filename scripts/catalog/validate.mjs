import { isValidRange } from "./semver-range.mjs";

export const PACKAGE_NAME_PATTERN =
  "^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$";
export const GITHUB_USERNAME_PATTERN =
  "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$";
export const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";
export const PACKAGE_NAME_MAX_LENGTH = 214;
export const DESCRIPTION_MAX_LENGTH = 160;

const packageName = new RegExp(PACKAGE_NAME_PATTERN);
const githubUsername = new RegExp(GITHUB_USERNAME_PATTERN);
const isoDate = new RegExp(DATE_PATTERN);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPackageName(value) {
  return (
    typeof value === "string" &&
    value.length <= PACKAGE_NAME_MAX_LENGTH &&
    packageName.test(value)
  );
}

export function isHttpsUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function isIsoDate(value) {
  if (typeof value !== "string" || !isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function checkDescription(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "must be a non-empty string";
  }
  if (value !== value.trim() || /\n/.test(value)) {
    return "must be a single line without surrounding spaces";
  }
  if (value.length > DESCRIPTION_MAX_LENGTH) {
    return `must be at most ${DESCRIPTION_MAX_LENGTH} characters`;
  }
  return null;
}

function checkMaintainers(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "must be a non-empty array of GitHub usernames";
  }
  const invalid = value.filter(
    (name) => typeof name !== "string" || !githubUsername.test(name),
  );
  if (invalid.length > 0) {
    return `must only contain GitHub usernames without "@" (invalid: ${invalid.map((name) => JSON.stringify(name)).join(", ")})`;
  }
  const lowered = value.map((name) => name.toLowerCase());
  if (new Set(lowered).size !== lowered.length) {
    return "must not repeat a username";
  }
  return null;
}

const fieldChecks = {
  package: (value) =>
    isPackageName(value) ? null : "must be a valid npm package name",
  repository: (value) =>
    isHttpsUrl(value) ? null : "must be an https URL without credentials",
  description: checkDescription,
  maintainers: checkMaintainers,
  kaneo: (value) =>
    isValidRange(value)
      ? null
      : 'must be a valid semver range, such as ">=2.29.0 <3"',
  addedAt: (value) =>
    isIsoDate(value) ? null : "must be a date in YYYY-MM-DD format",
  homepage: (value) =>
    isHttpsUrl(value) ? null : "must be an https URL without credentials",
};

export const ENTRY_FIELDS = Object.keys(fieldChecks);
export const REQUIRED_FIELDS = ENTRY_FIELDS.filter(
  (field) => field !== "homepage",
);

export function validateEntry(entry) {
  if (!isRecord(entry)) return ["must be an object"];

  const errors = [];
  for (const key of Object.keys(entry)) {
    if (!ENTRY_FIELDS.includes(key)) errors.push(`unknown field "${key}"`);
  }
  for (const field of ENTRY_FIELDS) {
    if (!(field in entry)) {
      if (REQUIRED_FIELDS.includes(field)) errors.push(`missing "${field}"`);
      continue;
    }
    const error = fieldChecks[field](entry[field]);
    if (error) errors.push(`"${field}" ${error}`);
  }
  return errors;
}

export function validateOrder(plugins) {
  const names = plugins
    .map((entry) => (isRecord(entry) ? entry.package : undefined))
    .filter((name) => typeof name === "string");

  const errors = [];
  const seen = new Set();
  const repeated = new Set();
  for (const name of names) {
    if (seen.has(name) && !repeated.has(name)) {
      repeated.add(name);
      errors.push(`"${name}" is listed more than once`);
    }
    seen.add(name);
  }
  for (let index = 1; index < names.length; index += 1) {
    if (names[index - 1] > names[index]) {
      errors.push(
        `"${names[index]}" must come before "${names[index - 1]}": keep plugins sorted by package name`,
      );
    }
  }
  return errors;
}

function entryLabel(entry, index) {
  return isRecord(entry) && typeof entry.package === "string"
    ? `plugins[${index}] (${entry.package})`
    : `plugins[${index}]`;
}

export function validateCatalog(catalog) {
  if (!isRecord(catalog)) return ["The catalog must be a JSON object"];

  const errors = [];
  for (const key of Object.keys(catalog)) {
    if (key !== "$schema" && key !== "plugins") {
      errors.push(`Unknown top-level field "${key}"`);
    }
  }
  if (!Array.isArray(catalog.plugins)) {
    errors.push('"plugins" must be an array');
    return errors;
  }

  catalog.plugins.forEach((entry, index) => {
    for (const error of validateEntry(entry)) {
      errors.push(`${entryLabel(entry, index)}: ${error}`);
    }
  });
  errors.push(...validateOrder(catalog.plugins));
  return errors;
}
