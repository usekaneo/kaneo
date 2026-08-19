import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

let shikiHighlighterPromise: Promise<Highlighter> | null = null;

const SHIKI_LANGUAGES = [
  "bash",
  "shellscript",
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
  "mermaid",
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
      // The default oniguruma engine runs on WebAssembly, which Chrome
      // enterprise policies (e.g. JavaScriptJitDisabled) can disable. With
      // WASM disabled, createHighlighter rejects and views waiting on it
      // never render.
      // The JavaScript engine doesn't require WASM. `forgiving` means a
      // pattern that can't be translated to a native RegExp stops matching
      // (worst case: one token type unhighlighted) instead of throwing at
      // creation. All bundled grammars translate as of Shiki 3.9.1.
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    }).catch((err) => {
      // Reset so a subsequent call can retry rather than reusing a
      // permanently-rejected promise.
      shikiHighlighterPromise = null;
      throw err;
    });
  }

  return shikiHighlighterPromise;
}
