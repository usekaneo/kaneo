import { createHighlighter, type Highlighter } from "shiki";

let shikiHighlighterPromise: Promise<Highlighter> | null = null;

const SHIKI_LANGUAGES = [
  "bash",
  "csharp",
  "cpp",
  "css",
  "clojure",
  "cypher",
  "dart",
  "diff",
  "elixir",
  "csv",
  "go",
  "graphql",
  "html",
  "haskell",
  "json",
  "java",
  "javascript",
  "kotlin",
  "makefile",
  "markdown",
  "ocaml",
  "php",
  "perl",
  "text",
  "python",
  "r",
  "ruby",
  "rust",
  "sql",
  "swift",
  "toml",
  "terraform",
  "typescript",
  "xml",
  "yaml",
] as const;

export function getSharedShikiHighlighter() {
  if (!shikiHighlighterPromise) {
    shikiHighlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [...SHIKI_LANGUAGES],
    });
  }

  return shikiHighlighterPromise;
}
