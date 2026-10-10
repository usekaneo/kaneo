const RESERVED = new Set([
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
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function baseImportName(packageName: string): string {
  const words = packageName
    .replace(/^@[^/]+\//, "")
    .replace(/^kaneo-plugin-/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  const [first, ...rest] = words;
  if (first === undefined) return "plugin";
  const name = first + rest.map(capitalize).join("");
  if (/^[0-9]/.test(name)) return `plugin${capitalize(name)}`;
  if (RESERVED.has(name)) return `${name}Plugin`;
  return name;
}

export function importNameFor(
  packageName: string,
  isTaken: (name: string) => boolean,
): string {
  const base = baseImportName(packageName);
  if (!isTaken(base)) return base;
  let suffix = 2;
  while (isTaken(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}
