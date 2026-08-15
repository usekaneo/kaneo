import { Extension, findChildren } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import DOMPurify from "dompurify";
import debounce from "@/lib/debounce";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { isDarkTheme, SHIKI_CODEBLOCK_REFRESH_META } from "./shiki-code-block";

const MERMAID_LANGUAGE = "mermaid";
const MERMAID_REFRESH_META = "mermaid-refresh";
const DEFAULT_ERROR_KEY = "tasks:detail.editor.mermaid.renderFailed";
const RENDER_DEBOUNCE_MS = 250;
const RENDER_CACHE_LIMIT = 20;
const mermaidPluginKey = new PluginKey("mermaid-block");

type RenderState =
  | { status: "done"; svg: string }
  | { status: "error"; message: string };

type MermaidBlockOptions = {
  errorKey: string;
};

type Scheduler = {
  want: (
    cacheKey: string,
    code: string,
    dark: boolean,
    explicit: boolean,
  ) => void;
  reset: () => void;
  flush: () => void;
  cancel: () => void;
  destroy: () => void;
};

const MERMAID_OPENERS =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey-beta|xychart-beta|block-beta|C4Context|architecture-beta|packet-beta|kanban|radar-beta|treemap-beta)\b/;

const renderCache = new Map<string, RenderState | null>();
let mermaidIdCounter = 0;
let initializedTheme: "dark" | "default" | null = null;

function isMermaid(code: string) {
  const opener = code
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("%%"));

  return opener !== undefined && MERMAID_OPENERS.test(opener);
}

// `inUse` is never evicted, so the limit is a floor rather than a ceiling: a
// document holding more diagrams than the limit grows the cache to fit instead
// of evicting entries the same pass still needs. Evicting them would leave
// `getDecorations` wanting them again on the refresh that follows every render,
// which never settles.
function cacheRender(cacheKey: string, state: RenderState, inUse: Set<string>) {
  renderCache.set(cacheKey, state);

  for (const key of renderCache.keys()) {
    if (renderCache.size <= RENDER_CACHE_LIMIT) return;
    if (inUse.has(key)) continue;
    renderCache.delete(key);
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
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });
    initializedTheme = theme;
  }

  mermaidIdCounter += 1;
  const { svg } = await mermaid.render(
    `kaneo-mermaid-${mermaidIdCounter}`,
    code,
  );

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}

function createScheduler(errorKey: string, onSettled: () => void): Scheduler {
  const wanted = new Map<
    string,
    { code: string; dark: boolean; explicit: boolean }
  >();
  let active = true;

  const flush = debounce(async () => {
    if (!active) return;

    const batch = [...wanted].filter(([key]) => !renderCache.has(key));
    if (batch.length === 0) return;

    // Every key the document is currently showing, not just the ones being
    // rendered now: an entry already cached and still on screen must survive
    // this pass too.
    const inUse = new Set(wanted.keys());

    await Promise.all(
      batch.map(async ([key, { code, dark, explicit }]) => {
        renderCache.set(key, null);
        try {
          cacheRender(
            key,
            {
              status: "done",
              svg: await renderMermaid(code, dark),
            },
            inUse,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          cacheRender(key, { status: "error", message }, inUse);
          if (explicit && active) {
            toast.error(i18n.t(errorKey), { description: message });
          }
        }
      }),
    );

    if (active) onSettled();
  }, RENDER_DEBOUNCE_MS);

  return {
    want: (cacheKey, code, dark, explicit) =>
      wanted.set(cacheKey, {
        code,
        dark,
        explicit: explicit || wanted.get(cacheKey)?.explicit === true,
      }),
    reset: () => wanted.clear(),
    flush: () => {
      if (wanted.size > 0) flush();
    },
    cancel: () => flush.cancel(),
    destroy: () => {
      active = false;
      flush.cancel();
      wanted.clear();
    },
  };
}

function createPreviewElement(state: RenderState | null) {
  const container = document.createElement("div");
  container.className = "kaneo-mermaid-preview";
  container.contentEditable = "false";

  if (!state || state.status === "error") {
    container.dataset.state = "loading";
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

      if (state?.status === "error") return;
      if (!renderCache.has(cacheKey)) {
        scheduler.want(cacheKey, code, dark, explicit);
      }

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

export const MermaidBlock = Extension.create<MermaidBlockOptions>({
  name: "mermaidBlock",

  addOptions() {
    return { errorKey: DEFAULT_ERROR_KEY };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    const scheduler = createScheduler(this.options.errorKey, () => {
      const { view } = editor;
      if (!view || view.isDestroyed) return;
      view.dispatch(view.state.tr.setMeta(MERMAID_REFRESH_META, true));
    });

    editor.once("destroy", () => scheduler.destroy());

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
        view: () => ({ destroy: () => scheduler.cancel() }),
        props: {
          decorations(state: EditorState) {
            return mermaidPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
