import {
  AttachmentCard,
  KaneoImage,
  KaneoIssueLink,
  KaneoTaskItem,
} from "@kaneo/editor";

function resolve(serverUrl: string, src: string): string {
  if (!src || /^(https?:|data:|blob:)/i.test(src)) return src;
  return `${serverUrl.replace(/\/+$/, "")}/${src.replace(/^\/+/, "")}`;
}

function chip(label: string): HTMLSpanElement {
  const dom = document.createElement("span");
  dom.className = "kaneo-chip";
  dom.contentEditable = "false";
  dom.textContent = label;
  return dom;
}

export function domNodeViews(serverUrl: string, attachmentLabel: string) {
  return {
    attachmentCard: AttachmentCard.extend({
      addNodeView() {
        return ({ node }) => ({
          dom: chip(String(node.attrs.filename || attachmentLabel)),
        });
      },
    }),
    kaneoIssueLink: KaneoIssueLink.extend({
      addNodeView() {
        return ({ node }) => ({
          dom: chip(String(node.attrs.issueKey || node.attrs.url || "")),
        });
      },
    }),
    taskItem: KaneoTaskItem.extend({
      addNodeView() {
        return ({ node, getPos, editor }) => {
          const dom = document.createElement("li");
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          const content = document.createElement("div");
          dom.dataset.type = "taskItem";
          label.contentEditable = "false";
          checkbox.type = "checkbox";
          const sync = (checked: boolean) => {
            dom.dataset.checked = String(checked);
            checkbox.checked = checked;
          };
          sync(!!node.attrs.checked);
          checkbox.addEventListener("mousedown", (e) => e.preventDefault());
          checkbox.addEventListener("change", () => {
            const pos = typeof getPos === "function" ? getPos() : undefined;
            const current =
              typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
            if (typeof pos !== "number" || !current) return;
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...current.attrs,
                checked: checkbox.checked,
              }),
            );
          });
          label.append(checkbox);
          dom.append(label, content);
          return {
            dom,
            contentDOM: content,
            update: (updated) => {
              if (updated.type !== node.type) return false;
              sync(!!updated.attrs.checked);
              return true;
            },
          };
        };
      },
    }),
    image: KaneoImage.extend({
      addNodeView() {
        return ({ node }) => {
          const dom = document.createElement("img");
          dom.src = resolve(serverUrl, String(node.attrs.src ?? ""));
          dom.alt = String(node.attrs.alt ?? "");
          dom.loading = "lazy";
          return { dom };
        };
      },
    }),
  };
}
