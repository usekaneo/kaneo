export const PLUGIN_RUNTIME_DIRECTORY = "plugin-runtime";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const RESERVED_WORDS = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export type SharedModuleShim = {
  specifier: string;
  fileName: string;
  source: string;
};

export function sharedModuleFileName(specifier: string): string {
  return `${specifier.replace(/^@/, "").replace(/[^A-Za-z0-9]+/g, "-")}.js`;
}

export function exportableNames(keys: Iterable<string>): string[] {
  return [...new Set(keys)]
    .filter(
      (key) =>
        key !== "__esModule" &&
        IDENTIFIER.test(key) &&
        !RESERVED_WORDS.has(key),
    )
    .sort();
}

export function createSharedModuleShim(
  specifier: string,
  keys: Iterable<string>,
  globalName: string,
): SharedModuleShim {
  const names = exportableNames(keys);
  const lines = [
    `const m = globalThis.${globalName}[${JSON.stringify(specifier)}];`,
    "export default m.default ?? m;",
  ];
  if (names.length > 0) {
    lines.push(`export const { ${names.join(", ")} } = m;`);
  }
  return {
    specifier,
    fileName: sharedModuleFileName(specifier),
    source: `${lines.join("\n")}\n`,
  };
}

export function sharedModulePath(fileName: string): string {
  return `${PLUGIN_RUNTIME_DIRECTORY}/${fileName}`;
}

export function sharedModuleUrl(base: string, fileName: string): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${sharedModulePath(fileName)}`;
}

export function createImportMap(
  shims: readonly Pick<SharedModuleShim, "specifier" | "fileName">[],
  base: string,
): { imports: Record<string, string> } {
  return {
    imports: Object.fromEntries(
      shims.map((shim) => [
        shim.specifier,
        sharedModuleUrl(base, shim.fileName),
      ]),
    ),
  };
}
