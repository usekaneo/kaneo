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

const RELOAD_FLAG = "shiki_chunk_reload_attempted";

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
    })
      .then((highlighter) => {
        // Initialize succeeded — clear the reload flag so a stale-chunk
        // failure from a later deployment in the same tab can recover via
        // reload instead of being treated as a loop attempt.
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          // sessionStorage unavailable — nothing to clear.
        }
        return highlighter;
      })
      .catch((err) => {
        // Reset so a subsequent call can retry rather than reusing a
        // permanently-rejected promise.
        shikiHighlighterPromise = null;

        // A dynamic import failure typically means the browser has a stale
        // version of the app (cached HTML referencing old content-hashed chunks)
        // and the asset no longer exists after a new deployment. Reloading
        // fetches the latest HTML and chunk filenames.
        if (
          err instanceof TypeError &&
          err.message.includes("Failed to fetch dynamically imported module")
        ) {
          try {
            if (!sessionStorage.getItem(RELOAD_FLAG)) {
              sessionStorage.setItem(RELOAD_FLAG, "1");
              window.location.reload();
              // Return a never-resolving promise so callers wait for the reload
              // rather than receiving a rejected promise.
              return new Promise<never>(() => {});
            }
            // Already reloaded once — fail silently so we don't loop.
            return Promise.reject(err);
          } catch {
            // sessionStorage access failed (disabled, private browsing, quota, etc.)
            // Skip reload attempt and rethrow the original error.
            throw err;
          }
        }

        throw err;
      });
  }

  return shikiHighlighterPromise;
}
