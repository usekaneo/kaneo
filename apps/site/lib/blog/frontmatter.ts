export type Frontmatter = Record<string, string | boolean>;

const DELIMITER = "---";

function parseValue(raw: string) {
  const value = raw.trim();

  if (value === "true") return true;
  if (value === "false") return false;

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1).replace(new RegExp(`\\\\${quote}`, "g"), quote);
  }

  return value;
}

/**
 * Minimal frontmatter reader for the flat `key: value` blocks used by posts.
 * Deliberately not a YAML parser: unsupported syntax throws at build time
 * rather than being silently ignored.
 */
export function parseFrontmatter(source: string, file: string) {
  const normalised = source.replace(/^﻿/, "");

  if (!normalised.startsWith(`${DELIMITER}\n`)) {
    throw new Error(
      `Blog post ${file} does not start with a "---" frontmatter block.`,
    );
  }

  const end = normalised.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (end === -1) {
    throw new Error(`Blog post ${file} has an unterminated frontmatter block.`);
  }

  const block = normalised.slice(DELIMITER.length + 1, end);
  const body = normalised
    .slice(end + DELIMITER.length + 1)
    .replace(/^\r?\n/, "");

  const data: Frontmatter = {};

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(
        `Blog post ${file} has a frontmatter line without a "key: value" pair: ${trimmed}`,
      );
    }

    const key = trimmed.slice(0, separator).trim();
    if (key === "") {
      throw new Error(
        `Blog post ${file} has a frontmatter entry with an empty key.`,
      );
    }

    data[key] = parseValue(trimmed.slice(separator + 1));
  }

  return { data, content: body };
}
