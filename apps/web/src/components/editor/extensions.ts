import type { AnyExtension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import type { Highlighter } from "shiki";
import { AttachmentCard } from "@/components/task/extensions/attachment-card";
import { EmbedBlock } from "@/components/task/extensions/embed-block";
import { KaneoIssueLink } from "@/components/task/extensions/kaneo-issue-link";
import { MermaidBlock } from "@/components/task/extensions/mermaid-block";
import { SafeHardBreak } from "@/components/task/extensions/safe-hard-break";
import { ShikiCodeBlock } from "@/components/task/extensions/shiki-code-block";
import { TaskItemWithCheckbox } from "@/components/task/extensions/task-item-with-checkbox";

export function createEditorExtensions({
  placeholder,
  highlighter,
  resolveLanguage,
  image,
  extra = [],
  mermaidErrorKey,
}: {
  placeholder: string;
  highlighter: () => Highlighter | null;
  resolveLanguage: (language: string) => string;
  image: AnyExtension;
  extra?: AnyExtension[];
  mermaidErrorKey?: string;
}) {
  return [
    StarterKit.configure({
      codeBlock: { HTMLAttributes: { class: "kaneo-tiptap-codeblock" } },
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
      hardBreak: false,
    }),
    SafeHardBreak,
    Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
    ShikiCodeBlock.configure({
      highlighter,
      resolveLanguage,
      themeDark: "github-dark",
      themeLight: "github-light",
    }),
    mermaidErrorKey
      ? MermaidBlock.configure({ errorKey: mermaidErrorKey })
      : MermaidBlock,
    EmbedBlock,
    AttachmentCard,
    KaneoIssueLink,
    ...extra,
    TaskList,
    image.configure({
      HTMLAttributes: { class: "kaneo-editor-image", loading: "lazy" },
    }),
    TaskItemWithCheckbox.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
