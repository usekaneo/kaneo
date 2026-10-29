import { importNameFor } from "../import-name.js";
import { appendItem } from "./append-item.js";
import { applyEdits, type Edit } from "./edits.js";
import { findConfigObject } from "./find-config-object.js";
import { findLastImport } from "./find-last-import.js";
import { findPluginsArray } from "./find-plugins-array.js";
import { maskSource } from "./mask-source.js";

export type ConfigEdit =
  | { status: "updated"; source: string; importName: string }
  | { status: "present" }
  | { status: "manual"; reason: string; importName: string };

const COMMON_JS = /(?<![\w$.])(?:require\s*\(|module\.exports\b)/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function importsPackage(
  source: string,
  code: string,
  packageName: string,
): boolean {
  const pattern = new RegExp(
    `(?<![\\w$.])(?:from|import)\\s*\\(?\\s*(["'])${escapeRegExp(packageName)}\\1`,
    "g",
  );
  return [...source.matchAll(pattern)].some(
    (match) => code.charAt(match.index) === source.charAt(match.index),
  );
}

function usesIdentifier(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`).test(code);
}

function defaultImport(
  source: string,
  code: string,
  packageName: string,
): { name: string; start: number; end: number } | null {
  const pattern = new RegExp(
    `(?<![\\w$.])import\\s+(?!type\\s)([A-Za-z_$][\\w$]*)\\s*(?:,\\s*\\{[^}]*\\}\\s*)?from\\s*(["'])${escapeRegExp(packageName)}\\2`,
    "g",
  );
  for (const match of source.matchAll(pattern)) {
    if (code.charAt(match.index) !== source.charAt(match.index)) continue;
    return {
      name: match[1] ?? "",
      start: match.index,
      end: match.index + match[0].length,
    };
  }
  return null;
}

function importStatement(
  importName: string,
  packageName: string,
  quote: string,
  semicolon: boolean,
): string {
  return `import ${importName} from ${quote}${packageName}${quote}${semicolon ? ";" : ""}`;
}

function topOfFile(source: string, statement: string): Edit {
  const at = source.startsWith("#!") ? source.indexOf("\n") + 1 : 0;
  const rest = source.slice(at);
  return { at, text: `${statement}\n${rest.startsWith("\n") ? "" : "\n"}` };
}

export function addPluginToConfig(
  source: string,
  packageName: string,
): ConfigEdit {
  const masked = maskSource(source);
  const code = masked ?? source;
  const imported = importsPackage(source, code, packageName);
  const existing = imported ? defaultImport(source, code, packageName) : null;

  const importName =
    existing?.name ??
    importNameFor(packageName, (name) => usesIdentifier(code, name));
  const manual = (reason: string): ConfigEdit => ({
    status: "manual",
    reason,
    importName,
  });

  if (masked === null) {
    return manual("it has a string or comment that never ends");
  }
  if (COMMON_JS.test(masked)) return manual("it uses CommonJS");
  if (imported && !existing) {
    return manual(`it imports ${packageName} without a default import`);
  }

  const object = findConfigObject(masked);
  if (typeof object === "string") return manual(object);
  const plugins = findPluginsArray(source, masked, object);
  if (plugins.kind === "unsupported") return manual(plugins.reason);

  if (existing) {
    const listed =
      plugins.kind === "array" &&
      usesIdentifier(
        masked.slice(plugins.open, plugins.close + 1),
        existing.name,
      );
    if (listed) return { status: "present" };
    const elsewhere = `${masked.slice(0, existing.start)}${masked.slice(existing.end)}`;
    if (usesIdentifier(elsewhere, existing.name)) {
      return manual(
        `it imports ${packageName} as ${existing.name} but does not list it in plugins`,
      );
    }
  }

  const call = `${importName}()`;
  const edits =
    plugins.kind === "array"
      ? appendItem(source, masked, plugins, call, "")
      : appendItem(source, masked, object, `plugins: [${call}]`, " ");

  if (!existing) {
    const lastImport = findLastImport(masked);
    if (lastImport.kind === "invalid") {
      return manual("its import statements could not be read");
    }
    if (lastImport.kind === "found") {
      const statement = importStatement(
        importName,
        packageName,
        lastImport.quote,
        lastImport.semicolon,
      );
      edits.push({ at: lastImport.end, text: `\n${statement}` });
    } else {
      edits.push(
        topOfFile(source, importStatement(importName, packageName, '"', true)),
      );
    }
  }

  return { status: "updated", source: applyEdits(source, edits), importName };
}
