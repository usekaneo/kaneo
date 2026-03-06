import { Extension, findChildren } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Highlighter } from "shiki";

type ShikiCodeBlockOptions = {
  defaultLanguage: string;
  highlighter: Highlighter | null | (() => Highlighter | null);
  resolveLanguage: (language: string) => string;
  themeDark: string;
  themeLight: string;
};

export const SHIKI_CODEBLOCK_REFRESH_META = "shiki-codeblock-refresh";
const shikiPluginKey = new PluginKey("shiki-codeblock");

function getCurrentTheme(options: ShikiCodeBlockOptions) {
  if (typeof document === "undefined") return options.themeDark;
  return document.documentElement.classList.contains("dark")
    ? options.themeDark
    : options.themeLight;
}

function resolveHighlighter(options: ShikiCodeBlockOptions) {
  if (typeof options.highlighter === "function") {
    return options.highlighter();
  }

  return options.highlighter;
}

function getDecorations(doc: ProseMirrorNode, options: ShikiCodeBlockOptions) {
  const highlighter = resolveHighlighter(options);
  if (!highlighter) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const theme = getCurrentTheme(options);

  findChildren(doc, (node) => node.type.name === "codeBlock").forEach(
    (block) => {
      const code = block.node.textContent;
      if (!code) return;

      const rawLanguage =
        (block.node.attrs.language as string | undefined) || "";
      const normalizedLanguage = options.resolveLanguage(
        rawLanguage || options.defaultLanguage,
      );
      let tokensResult: ReturnType<Highlighter["codeToTokens"]>;

      try {
        tokensResult = highlighter.codeToTokens(code, {
          lang: normalizedLanguage as never,
          theme: theme as never,
        });
      } catch {
        tokensResult = highlighter.codeToTokens(code, {
          lang: "text" as never,
          theme: theme as never,
        });
      }

      let from = block.pos + 1;
      for (
        let lineIndex = 0;
        lineIndex < tokensResult.tokens.length;
        lineIndex += 1
      ) {
        const line = tokensResult.tokens[lineIndex];
        for (const token of line) {
          const text = token.content || "";
          if (!text.length) continue;

          const to = from + text.length;
          const styles: string[] = [];
          if (token.color) styles.push(`color:${token.color}`);
          if (typeof token.fontStyle === "number") {
            if ((token.fontStyle & 1) !== 0) styles.push("font-style:italic");
            if ((token.fontStyle & 2) !== 0) styles.push("font-weight:600");
            if ((token.fontStyle & 4) !== 0) {
              styles.push("text-decoration:underline");
            }
          }

          if (styles.length > 0) {
            decorations.push(
              Decoration.inline(from, to, { style: styles.join(";") }),
            );
          }
          from = to;
        }

        if (lineIndex < tokensResult.tokens.length - 1) {
          from += 1;
        }
      }
    },
  );

  return DecorationSet.create(doc, decorations);
}

export const ShikiCodeBlock = Extension.create<ShikiCodeBlockOptions>({
  name: "shikiCodeBlock",

  addOptions() {
    return {
      defaultLanguage: "text",
      highlighter: null,
      resolveLanguage: (language: string) => language,
      themeDark: "github-dark",
      themeLight: "github-light",
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: shikiPluginKey,
        state: {
          init: (_config: unknown, state: EditorState) =>
            getDecorations(state.doc, options),
          apply: (transaction: Transaction, decorationSet: DecorationSet) => {
            if (
              transaction.docChanged ||
              transaction.getMeta(SHIKI_CODEBLOCK_REFRESH_META)
            ) {
              return getDecorations(transaction.doc, options);
            }

            return decorationSet.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return shikiPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
