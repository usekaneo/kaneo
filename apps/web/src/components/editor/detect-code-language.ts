const SAMPLE_LENGTH = 2000;

const SIGNATURES: [language: string, pattern: RegExp][] = [
  ["diff", /^(?:diff --git |\+\+\+ |--- |@@ )/m],
  ["php", /<\?php|\$\w+\s*->\s*\w+/],
  [
    "html",
    /^\s*<(?:!doctype html|html|head|body|div|span|p|a|ul|ol|li|section|main|header|footer|nav|button|input|form|img|table|script|style|template)\b/i,
  ],
  ["xml", /^\s*<(?:\?xml\b|[\w:-]+[\s/>])/],
  [
    "sql",
    /^\s*(?:select\s[\s\S]*\bfrom\b|insert\s+into\b|update\s+\w+\s+set\b|delete\s+from\b|create\s+(?:table|index|view)\b|alter\s+table\b|drop\s+table\b|with\s+\w+\s+as\s*\()/im,
  ],
  ["graphql", /^\s*(?:query|mutation|subscription|fragment)\b[^{]*\{/m],
  [
    "swift",
    /\bfunc\s+\w+\s*\([^)]*\)\s*->|\bguard\s+let\b|\bimport\s+(?:UIKit|SwiftUI|Foundation)\b/,
  ],
  [
    "rust",
    /\bfn\s+\w+\s*[<(]|\blet\s+mut\b|\b\w+!\(|\bimpl\b[^{\n]*\{|\bpub\s+(?:fn|struct|enum)\b/,
  ],
  [
    "python",
    /^\s*(?:def|class)\s+\w+[^\n{]*:\s*$|^\s*from\s+[\w.]+\s+import\b|^\s*import\s+[\w.]+\s*$|\bprint\(|\bself\.\w+|\belif\b/m,
  ],
  ["go", /^package\s+\w+|\bfunc\s+(?:\([^)]*\)\s*)?\w+\s*\(|\b\w+\s*:=/m],
  [
    "ruby",
    /^\s*def\s+\w+[^:\n]*$|^\s*end\s*$|\bputs\s|\.each\s+do\b|^\s*require\s+['"]/m,
  ],
  ["csharp", /\busing\s+System\b|\bConsole\.Write|\bnamespace\s+[\w.]+\s*[{;]/],
  [
    "java",
    /\bpublic\s+(?:static\s+)?(?:final\s+)?(?:class|void|interface)\b|\bSystem\.out\.|\bimport\s+java\./,
  ],
  ["kotlin", /\bfun\s+\w+\s*\(|\bval\s+\w+\s*[:=]/],
  [
    "typescript",
    /\binterface\s+\w+|\btype\s+\w+\s*=|\b\w+\??\s*:\s*(?:string|number|boolean|void|unknown|any|never)\b|\bas\s+const\b/,
  ],
  [
    "bash",
    /^\s*(?:#!\/|\$ |sudo\s|npm\s|npx\s|pnpm\s|yarn\s|bun\s|git\s|cd\s|ls\b|echo\s|curl\s|docker\s|brew\s|apt(?:-get)?\s|mkdir\s|rm\s+-|export\s+\w+=)/m,
  ],
  [
    "javascript",
    /\b(?:const|let|var)\s+[\w{[]|=>|\bfunction\b|\bconsole\.\w+\(|\brequire\(|\bimport\s[^\n]+\sfrom\s+['"]|\bexport\s+(?:default|const|function|class)\b/,
  ],
  ["css", /^\s*[.#@]?[\w-][^{}\n]*\{[^}]*\b[\w-]+\s*:\s*[^;{}]+;/m],
  ["markdown", /^(?:#{1,6}\s+\S|\s*[-*]\s+\[[ x]\]\s|>\s+\S|```)/m],
];

function isJson(code: string) {
  if (!/^[[{]/.test(code)) return false;
  try {
    JSON.parse(code);
    return true;
  } catch {
    return false;
  }
}

function isYaml(code: string) {
  if (/[{};]/.test(code)) return false;
  const lines = code.split("\n").filter((line) => line.trim());
  return (
    lines.length > 0 &&
    lines.every((line) => /^\s*(?:-\s+|[\w.-]+:(?:\s|$)|#|---)/.test(line))
  );
}

export function detectCodeLanguage(code: string): string | null {
  const sample = code.slice(0, SAMPLE_LENGTH).trim();
  if (!sample) return null;
  if (isJson(sample)) return "json";

  for (const [language, pattern] of SIGNATURES) {
    if (pattern.test(sample)) return language;
  }

  return isYaml(sample) ? "yaml" : null;
}
