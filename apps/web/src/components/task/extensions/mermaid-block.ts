import { Extension, findChildren } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import debounce from "@/lib/debounce";
import { isDarkTheme, SHIKI_CODEBLOCK_REFRESH_META } from "./shiki-code-block";

const MERMAID_LANGUAGE = "mermaid";
const MERMAID_REFRESH_META = "mermaid-refresh";
const RENDER_DEBOUNCE_MS = 250;
const RENDER_CACHE_LIMIT = 20;
const mermaidPluginKey = new PluginKey("mermaid-block");

type RenderState =
  | { status: "done"; svg: string }
  | { status: "error"; message: string };

type Scheduler = {
  want: (cacheKey: string, code: string, dark: boolean) => void;
  reset: () => void;
  flush: () => void;
};

const MERMAID_OPENERS =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey-beta|xychart-beta|block-beta|C4Context|architecture-beta|packet-beta|kanban|radar-beta|treemap-beta)\b/;

const renderCache = new Map<string, RenderState | null>();
let mermaidIdCounter = 0;
let initializedTheme: "dark" | "default" | null = null;

function isMermaid(code: string) {
  const firstLine = code.split("\n", 1)[0].trim();
  return MERMAID_OPENERS.test(firstLine);
}

function cacheRender(cacheKey: string, state: RenderState) {
  renderCache.set(cacheKey, state);
  if (renderCache.size > RENDER_CACHE_LIMIT) {
    const oldest = renderCache.keys().next().value;
    if (oldest !== undefined) renderCache.delete(oldest);
  }
}

async function renderMermaid(code: string, dark: boolean) {
  const { default: mermaid } = await import("mermaid");
  const theme = dark ? "dark" : "default";

  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      fontFamily: "inherit",
    });
    initializedTheme = theme;
  }

  mermaidIdCounter += 1;
  const { svg } = await mermaid.render(
    `kaneo-mermaid-${mermaidIdCounter}`,
    code,
  );
  return svg;
}

function createScheduler(onSettled: () => void): Scheduler {
  const wanted = new Map<string, { code: string; dark: boolean }>();

  const flush = debounce(async () => {
    const batch = [...wanted].filter(([key]) => !renderCache.has(key));
    if (batch.length === 0) return;

    await Promise.all(
      batch.map(async ([key, { code, dark }]) => {
        renderCache.set(key, null);
        try {
          cacheRender(key, {
            status: "done",
            svg: await renderMermaid(code, dark),
          });
        } catch (error) {
          cacheRender(key, {
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    onSettled();
  }, RENDER_DEBOUNCE_MS);

  return {
    want: (cacheKey, code, dark) => wanted.set(cacheKey, { code, dark }),
    reset: () => wanted.clear(),
    flush: () => {
      if (wanted.size > 0) flush();
    },
  };
}

function createPreviewElement(state: RenderState | null) {
  const container = document.createElement("div");
  container.className = "kaneo-mermaid-preview";
  container.contentEditable = "false";

  if (!state) {
    container.dataset.state = "loading";
    return container;
  }

  if (state.status === "error") {
    container.dataset.state = "error";
    container.textContent = state.message;
    return container;
  }

  container.dataset.state = "done";
  container.innerHTML = state.svg;
  return container;
}

function getDecorations(doc: ProseMirrorNode, scheduler: Scheduler) {
  const dark = isDarkTheme();
  const decorations: Decoration[] = [];

  scheduler.reset();

  findChildren(doc, (node) => node.type.name === "codeBlock").forEach(
    (block) => {
      const language = (
        (block.node.attrs.language as string | undefined) || ""
      ).toLowerCase();
      const code = block.node.textContent.trim();
      if (!code) return;

      const explicit = language === MERMAID_LANGUAGE;
      if (language && !explicit) return;
      if (!explicit && !isMermaid(code)) return;

      const cacheKey = `${dark ? "dark" : "light"}:${code}`;
      const state = renderCache.get(cacheKey) ?? null;

      if (state?.status === "error" && !explicit) return;
      if (!renderCache.has(cacheKey)) scheduler.want(cacheKey, code, dark);

      decorations.push(
        Decoration.widget(
          block.pos + block.node.nodeSize,
          () => createPreviewElement(state),
          { key: `${cacheKey}:${state?.status ?? "loading"}`, side: 1 },
        ),
      );
    },
  );

  scheduler.flush();

  return DecorationSet.create(doc, decorations);
}

export const MermaidBlock = Extension.create({
  name: "mermaidBlock",

  addProseMirrorPlugins() {
    const editor = this.editor;

    const scheduler = createScheduler(() => {
      const { view } = editor;
      if (!view || view.isDestroyed) return;
      view.dispatch(view.state.tr.setMeta(MERMAID_REFRESH_META, true));
    });

    return [
      new Plugin({
        key: mermaidPluginKey,
        state: {
          init: (_config: unknown, state: EditorState) =>
            getDecorations(state.doc, scheduler),
          apply: (transaction: Transaction, decorationSet: DecorationSet) => {
            if (
              transaction.docChanged ||
              transaction.getMeta(MERMAID_REFRESH_META) ||
              transaction.getMeta(SHIKI_CODEBLOCK_REFRESH_META)
            ) {
              return getDecorations(transaction.doc, scheduler);
            }

            return decorationSet.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return mermaidPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
