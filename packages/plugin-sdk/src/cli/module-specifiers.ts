const PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\/\/\/\s*<reference\s+types\s*=\s*["']([^"']+)["']/g,
];

export function findModuleSpecifiers(code: string): string[] {
  const specifiers = new Set<string>();
  for (const pattern of PATTERNS) {
    for (const match of code.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1]);
    }
  }
  return [...specifiers];
}

export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  );
}

export function isUrlSpecifier(specifier: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(specifier) && !specifier.startsWith("node:")
  );
}

export function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : (parts[0] ?? specifier);
}
